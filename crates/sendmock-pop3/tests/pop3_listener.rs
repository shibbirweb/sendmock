use std::sync::Arc;

use sendmock_core::{SystemClock, SystemIdGenerator};
use sendmock_ops::{
    InstanceDetails, OperationContext, RecentEventFilter, ReleaseChannel, SmtpMessage,
    store_smtp_message,
};
use sendmock_pop3::{OperationsMailbox, Pop3Login, Pop3Server, serve_pop3};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS, ProjectRecord};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::watch;

type TestResult = Result<(), Box<dyn std::error::Error>>;

fn build_operation_context() -> Result<OperationContext, Box<dyn std::error::Error>> {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)?;
    Ok(OperationContext::new(
        Arc::new(database),
        Arc::new(SystemClock),
        Arc::new(SystemIdGenerator),
        InstanceDetails {
            version: "0.1.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 0,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            catcher_address: None,
            pop3_address: None,
            is_container: false,
        },
    ))
}

/// A POP3 listener on a free port over the context; answers its address.
async fn start_listener(operation_context: &OperationContext) -> Result<String, std::io::Error> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let listen_address = listener.local_addr()?.to_string();
    let pop3_server = Arc::new(Pop3Server {
        login: Pop3Login::AcceptAny,
        mailbox: OperationsMailbox::new(operation_context.clone()),
    });
    let (shutdown_sender, shutdown_receiver) = watch::channel(false);
    tokio::spawn(async move {
        serve_pop3(listener, pop3_server, shutdown_receiver).await;
        drop(shutdown_sender);
    });
    Ok(listen_address)
}

async fn receive_over_smtp(
    operation_context: &OperationContext,
    subject: &str,
    auth_user: Option<&str>,
) -> Result<String, sendmock_ops::OperationError> {
    store_smtp_message(
        operation_context,
        SmtpMessage {
            raw_message: format!("Subject: {subject}\r\n\r\nHello\r\n").into_bytes(),
            mail_from: "shop@app.test".to_owned(),
            recipients: vec!["sam@example.test".to_owned()],
            smtp_session_id: "01JCK0000000000000000000SM".to_owned(),
            auth_user: auth_user.map(str::to_owned),
        },
    )
    .await
}

/// A plain POP3 client: sends a line, reads one line or a whole multi-line answer.
struct Pop3TestClient {
    reader: BufReader<tokio::net::tcp::OwnedReadHalf>,
    writer: tokio::net::tcp::OwnedWriteHalf,
}

impl Pop3TestClient {
    async fn connect(listen_address: &str) -> Result<Self, std::io::Error> {
        let (read_half, writer) = TcpStream::connect(listen_address).await?.into_split();
        let mut client = Self {
            reader: BufReader::new(read_half),
            writer,
        };
        client.read_line().await?;
        Ok(client)
    }

    async fn read_line(&mut self) -> Result<String, std::io::Error> {
        let mut reply_line = String::new();
        self.reader.read_line(&mut reply_line).await?;
        Ok(reply_line)
    }

    async fn send(&mut self, command_line: &str) -> Result<String, std::io::Error> {
        self.writer
            .write_all(format!("{command_line}\r\n").as_bytes())
            .await?;
        self.read_line().await
    }

    /// A command whose answer ends with a `.` line, such as RETR and UIDL.
    async fn send_multiline(&mut self, command_line: &str) -> Result<String, std::io::Error> {
        let mut answer = self.send(command_line).await?;
        loop {
            let answer_line = self.read_line().await?;
            if answer_line == ".\r\n" || answer_line.is_empty() {
                return Ok(answer);
            }
            answer.push_str(&answer_line);
        }
    }

    async fn sign_in(&mut self, username: &str) -> Result<String, std::io::Error> {
        self.send(&format!("USER {username}")).await?;
        self.send("PASS any").await
    }
}

// AC: EM-21.3 EM-21.4
#[tokio::test]
async fn a_project_key_login_reads_that_projects_mail_and_others_read_default() -> TestResult {
    let operation_context = build_operation_context()?;
    operation_context
        .project_repository
        .insert_project(ProjectRecord {
            project_key: "shop".to_owned(),
            name: "Shop".to_owned(),
            ..ProjectRecord::default()
        })
        .await?;
    let shop_email_id = receive_over_smtp(&operation_context, "Shop receipt", Some("shop")).await?;
    receive_over_smtp(&operation_context, "Default one", None).await?;
    receive_over_smtp(&operation_context, "Default two", None).await?;
    let listen_address = start_listener(&operation_context).await?;

    let mut shop_client = Pop3TestClient::connect(&listen_address).await?;
    let shop_sign_in = shop_client.sign_in("shop").await?;
    let shop_uids = shop_client.send_multiline("UIDL").await?;
    let shop_message = shop_client.send_multiline("RETR 1").await?;
    let mut other_client = Pop3TestClient::connect(&listen_address).await?;
    let other_sign_in = other_client.sign_in("laravel-app").await?;
    let first_default_message = other_client.send_multiline("TOP 1 0").await?;

    assert_eq!(shop_sign_in, "+OK signed in, 1 messages\r\n");
    assert_eq!(shop_uids, format!("+OK\r\n1 {shop_email_id}\r\n"));
    assert!(
        shop_message.contains("Subject: Shop receipt\r\n"),
        "{shop_message}"
    );
    assert_eq!(other_sign_in, "+OK signed in, 2 messages\r\n");
    assert!(
        first_default_message.contains("Subject: Default one"),
        "{first_default_message}"
    );
    Ok(())
}

// AC: EM-21.5
#[tokio::test]
async fn quit_deletes_the_marked_emails_and_fires_email_deleted() -> TestResult {
    let operation_context = build_operation_context()?;
    let kept_email_id = receive_over_smtp(&operation_context, "Keep me", None).await?;
    let deleted_email_id = receive_over_smtp(&operation_context, "Delete me", None).await?;
    let listen_address = start_listener(&operation_context).await?;

    let mut dropped_client = Pop3TestClient::connect(&listen_address).await?;
    dropped_client.sign_in("me").await?;
    dropped_client.send("DELE 1").await?;
    drop(dropped_client);
    let mut client = Pop3TestClient::connect(&listen_address).await?;
    client.sign_in("me").await?;
    client.send("DELE 2").await?;
    let quit_reply = client.send("QUIT").await?;

    assert!(quit_reply.starts_with("+OK"), "{quit_reply}");
    let email_repository = &operation_context.email_repository;
    assert!(email_repository.find_email(&kept_email_id).await?.is_some());
    assert!(
        email_repository
            .find_email(&deleted_email_id)
            .await?
            .is_none()
    );
    let deleted_events = operation_context
        .event_bus
        .recent_events(&RecentEventFilter {
            event_type: Some("email.deleted".to_owned()),
            limit: 10,
            ..RecentEventFilter::default()
        });
    assert_eq!(deleted_events.len(), 1);
    Ok(())
}

// AC: EM-21.1
#[tokio::test]
async fn a_line_that_is_too_long_is_refused_and_the_session_goes_on() -> TestResult {
    let operation_context = build_operation_context()?;
    let listen_address = start_listener(&operation_context).await?;
    let mut client = Pop3TestClient::connect(&listen_address).await?;

    let long_line_reply = client.send(&format!("USER {}", "x".repeat(600))).await?;
    let noop_reply = client.send("NOOP").await?;

    assert_eq!(long_line_reply, "-ERR line too long\r\n");
    assert_eq!(noop_reply, "+OK\r\n");
    Ok(())
}
