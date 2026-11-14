mod message_headers;
mod sendmail_arguments;

use std::io::Read;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::process::ExitCode;

use sendmock_smtp::SmtpSubmissionClient;

use message_headers::{read_addressing_headers, remove_bcc_header};
use sendmail_arguments::parse_sendmail_arguments;

/// The `sysexits.h` codes callers such as PHP and cron understand.
const EXIT_USAGE: u8 = 64;
const EXIT_TEMPORARY_FAILURE: u8 = 75;
const DEFAULT_SMTP_ADDR: SocketAddr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 1025);

/// `sendmock sendmail` (or the binary started as `sendmail`): reads one message from stdin
/// and hands it to the SMTP listener at `SENDMOCK_SMTP_ADDR`, so it is stored like any
/// SMTP message.
pub fn run_sendmail_shim(arguments: &[String]) -> ExitCode {
    let sendmail_arguments = parse_sendmail_arguments(arguments);
    let mut message_text = String::new();
    if let Err(read_error) = std::io::stdin().read_to_string(&mut message_text) {
        eprintln!("sendmail: could not read the message: {read_error}");
        return ExitCode::from(EXIT_USAGE);
    }
    let addressing_headers = read_addressing_headers(&message_text);
    let mut recipients = sendmail_arguments.recipients;
    if sendmail_arguments.reads_recipients_from_headers {
        recipients.extend(addressing_headers.recipient_addresses);
        message_text = remove_bcc_header(&message_text);
    }
    if recipients.is_empty() {
        eprintln!("sendmail: no recipients; pass them as arguments or use -t");
        return ExitCode::from(EXIT_USAGE);
    }
    let envelope_sender = sendmail_arguments
        .envelope_sender
        .or(addressing_headers.from_address)
        .unwrap_or_else(|| {
            format!(
                "{}@localhost",
                std::env::var("USER").unwrap_or_else(|_| "sendmail".to_owned())
            )
        });
    submit_message(&envelope_sender, &recipients, message_text.as_bytes())
}

fn submit_message(envelope_sender: &str, recipients: &[String], raw_message: &[u8]) -> ExitCode {
    let submission_client = SmtpSubmissionClient::new(read_smtp_addr());
    let submission = async {
        submission_client
            .submit_message(envelope_sender, recipients, raw_message)
            .await
    };
    let submitted = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|runtime_error| runtime_error.to_string())
        .and_then(|runtime| runtime.block_on(submission));
    match submitted {
        Ok(_) => ExitCode::SUCCESS,
        Err(submission_problem) => {
            eprintln!("sendmail: SendMock did not take the message: {submission_problem}");
            ExitCode::from(EXIT_TEMPORARY_FAILURE)
        }
    }
}

/// `SENDMOCK_SMTP_ADDR`, reached on loopback when it names every interface.
fn read_smtp_addr() -> SocketAddr {
    match std::env::var("SENDMOCK_SMTP_ADDR")
        .ok()
        .and_then(|addr_setting| addr_setting.parse::<SocketAddr>().ok())
    {
        Some(smtp_addr) if smtp_addr.ip().is_unspecified() => {
            SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), smtp_addr.port())
        }
        Some(smtp_addr) => smtp_addr,
        None => DEFAULT_SMTP_ADDR,
    }
}
