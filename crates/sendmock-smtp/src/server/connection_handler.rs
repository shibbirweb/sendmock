use std::net::SocketAddr;
use std::sync::Arc;

use sendmock_ops::{SmtpMessage, find_recipient_refusal, record_smtp_session, store_smtp_message};
use sendmock_store::SmtpSessionRecord;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

use super::message_data_reader::{IDLE_TIMEOUT, MessageData, read_message_data};
use super::smtp_server::SmtpServer;
use crate::{SessionAction, SessionResult, SmtpReply, SmtpSession};

/// Longer lines are refused; RFC 5321 allows 1000 octets, this leaves room for SMTPUTF8.
const MAXIMUM_LINE_BYTES: usize = 4096;

/// How one phase of a session (before or after STARTTLS) ended.
enum PhaseEnd<Stream> {
    Closed,
    UpgradeToTls(BufReader<Stream>),
}

/// Runs one connection to the end and records its session log.
pub async fn handle_connection(
    tcp_stream: TcpStream,
    remote_address: SocketAddr,
    server: Arc<SmtpServer>,
    is_implicit_tls: bool,
) {
    let operation_context = &server.operation_context;
    let session_id = operation_context.id_generator.generate_id().to_string();
    let started_at_unix_ms = operation_context.clock.now_unix_ms();
    let mut session = SmtpSession::new(Arc::clone(&server.session_settings));
    run_connection(
        tcp_stream,
        &server,
        &mut session,
        &session_id,
        is_implicit_tls,
    )
    .await;
    let session_record = SmtpSessionRecord {
        session_id,
        started_at_unix_ms,
        ended_at_unix_ms: operation_context.clock.now_unix_ms(),
        remote_address: remote_address.to_string(),
        helo_name: session.helo_name().to_owned(),
        tls_version: session.tls_version().map(str::to_owned),
        auth_mechanism: session.auth_mechanism().map(str::to_owned),
        auth_user: session.auth_user().map(str::to_owned),
        result: match session.result() {
            SessionResult::Delivered => "delivered",
            SessionResult::Rejected => "rejected",
            SessionResult::Aborted => "aborted",
        }
        .to_owned(),
        failure_reason: session.failure_reason().map(str::to_owned),
        email_ids: session.email_ids().to_vec(),
        transcript: session.transcript_text(),
    };
    if let Err(record_error) = record_smtp_session(operation_context, session_record).await {
        tracing::warn!(error = %record_error, "could not record an SMTP session");
    }
}

async fn run_connection(
    tcp_stream: TcpStream,
    server: &SmtpServer,
    session: &mut SmtpSession,
    session_id: &str,
    is_implicit_tls: bool,
) {
    let Some(tls_acceptor) = server.tls_acceptor.clone().filter(|_| is_implicit_tls) else {
        if let PhaseEnd::UpgradeToTls(plain_reader) = run_phase(
            BufReader::new(tcp_stream),
            server,
            session,
            session_id,
            true,
        )
        .await
        {
            upgrade_and_continue(plain_reader.into_inner(), server, session, session_id).await;
        }
        return;
    };
    match tls_acceptor.accept(tcp_stream).await {
        Ok(tls_stream) => {
            let tls_version = describe_tls_version(&tls_stream);
            session.tls_started(tls_version);
            run_phase(
                BufReader::new(tls_stream),
                server,
                session,
                session_id,
                true,
            )
            .await;
        }
        Err(handshake_error) => {
            session.note_connection_problem(&format!("TLS handshake failed: {handshake_error}"))
        }
    }
}

async fn upgrade_and_continue(
    tcp_stream: TcpStream,
    server: &SmtpServer,
    session: &mut SmtpSession,
    session_id: &str,
) {
    let Some(tls_acceptor) = server.tls_acceptor.clone() else {
        return;
    };
    match tls_acceptor.accept(tcp_stream).await {
        Ok(tls_stream) => {
            session.tls_started(describe_tls_version(&tls_stream));
            run_phase(
                BufReader::new(tls_stream),
                server,
                session,
                session_id,
                false,
            )
            .await;
        }
        Err(handshake_error) => {
            session.note_connection_problem(&format!("TLS handshake failed: {handshake_error}"))
        }
    }
}

fn describe_tls_version(tls_stream: &tokio_rustls::server::TlsStream<TcpStream>) -> Option<String> {
    tls_stream
        .get_ref()
        .1
        .protocol_version()
        .map(|protocol_version| match protocol_version {
            rustls::ProtocolVersion::TLSv1_3 => "TLSv1.3".to_owned(),
            rustls::ProtocolVersion::TLSv1_2 => "TLSv1.2".to_owned(),
            other_version => format!("{other_version:?}"),
        })
}

async fn run_phase<Stream: AsyncRead + AsyncWrite + Unpin>(
    mut reader: BufReader<Stream>,
    server: &SmtpServer,
    session: &mut SmtpSession,
    session_id: &str,
    sends_greeting: bool,
) -> PhaseEnd<Stream> {
    if sends_greeting
        && write_reply(&mut reader, &session.greeting().to_wire())
            .await
            .is_err()
    {
        return PhaseEnd::Closed;
    }
    loop {
        let Some(command_line) = read_command_line(&mut reader, session).await else {
            return PhaseEnd::Closed;
        };
        let action = match session.handle_line(&command_line) {
            SessionAction::CheckRecipient(forward_path) => {
                SessionAction::Reply(check_recipient(server, session, forward_path).await)
            }
            other_action => other_action,
        };
        let Some(reply_text) = action.reply().map(SmtpReply::to_wire) else {
            return PhaseEnd::Closed;
        };
        if write_reply(&mut reader, &reply_text).await.is_err() {
            return PhaseEnd::Closed;
        }
        match action {
            SessionAction::Reply(_) | SessionAction::CheckRecipient(_) => {}
            SessionAction::ReceiveData(_) => {
                if !receive_message(&mut reader, server, session, session_id).await {
                    return PhaseEnd::Closed;
                }
            }
            SessionAction::UpgradeToTls(_) => return PhaseEnd::UpgradeToTls(reader),
            SessionAction::Close(_) => return PhaseEnd::Closed,
        }
    }
}

/// Refuses the recipient when a `reject` outcome rule matches it; when the rules cannot be
/// read, the client is asked to try again later rather than the mail being lost.
async fn check_recipient(
    server: &SmtpServer,
    session: &mut SmtpSession,
    forward_path: String,
) -> SmtpReply {
    let refusal = match find_recipient_refusal(&server.operation_context, &forward_path).await {
        Ok(refusal) => {
            refusal.map(|refusal| SmtpReply::new(refusal.reply_code, refusal.reply_text))
        }
        Err(rule_error) => {
            tracing::warn!(error = %rule_error, "could not read the email outcome rules");
            Some(SmtpReply::new(
                451,
                "4.3.0 Could not check the recipient, try again",
            ))
        }
    };
    session.finish_recipient(forward_path, refusal)
}

/// One command line without its line ending; `None` when the client is gone or idle too long.
async fn read_command_line<Stream: AsyncRead + AsyncWrite + Unpin>(
    reader: &mut BufReader<Stream>,
    session: &mut SmtpSession,
) -> Option<String> {
    let mut line_bytes = Vec::new();
    loop {
        line_bytes.clear();
        match tokio::time::timeout(IDLE_TIMEOUT, reader.read_until(b'\n', &mut line_bytes)).await {
            Ok(Ok(0)) => {
                session.note_connection_problem("The client disconnected");
                return None;
            }
            Ok(Ok(_)) if line_bytes.len() > MAXIMUM_LINE_BYTES => {
                write_reply(reader, "500 Line too long\r\n").await.ok()?;
            }
            Ok(Ok(_)) => {
                return Some(
                    String::from_utf8_lossy(&line_bytes)
                        .trim_end_matches(['\r', '\n'])
                        .to_owned(),
                );
            }
            Ok(Err(read_error)) => {
                session.note_connection_problem(&format!(
                    "Reading from the client failed: {read_error}"
                ));
                return None;
            }
            Err(_) => {
                session.note_connection_problem("The client was idle too long");
                return None;
            }
        }
    }
}

/// Reads the message after 354, stores it and answers; false when the client is gone.
async fn receive_message<Stream: AsyncRead + AsyncWrite + Unpin>(
    reader: &mut BufReader<Stream>,
    server: &SmtpServer,
    session: &mut SmtpSession,
    session_id: &str,
) -> bool {
    let reply = match read_message_data(reader, session.max_size_bytes()).await {
        MessageData::Complete(raw_message) => {
            let envelope = session.envelope();
            let size_bytes = raw_message.len();
            let smtp_message = SmtpMessage {
                raw_message,
                mail_from: envelope.mail_from,
                recipients: envelope.recipients,
                smtp_session_id: session_id.to_owned(),
                auth_user: session.auth_user().map(str::to_owned),
            };
            let stored_email_id = store_smtp_message(&server.operation_context, smtp_message)
                .await
                .map_err(|store_error| store_error.to_string());
            session.complete_message(size_bytes, stored_email_id)
        }
        MessageData::TooLarge(size_bytes) => session.reject_oversized_message(size_bytes),
        MessageData::Disconnected => {
            session.note_connection_problem("The client disconnected during DATA");
            return false;
        }
    };
    write_reply(reader, &reply.to_wire()).await.is_ok()
}

async fn write_reply<Stream: AsyncRead + AsyncWrite + Unpin>(
    reader: &mut BufReader<Stream>,
    reply_text: &str,
) -> std::io::Result<()> {
    let stream = reader.get_mut();
    stream.write_all(reply_text.as_bytes()).await?;
    stream.flush().await
}
