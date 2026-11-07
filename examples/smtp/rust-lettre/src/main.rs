//! lettre's SMTP transport without TLS, as a local Rust app sends.

use lettre::{Message, SmtpTransport, Transport};

fn read_setting(name: &str, default_value: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default_value.to_owned())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let message = Message::builder()
        .from("App <app@rust.test>".parse()?)
        .to("user@example.test".parse()?)
        .subject(read_setting("SUBJECT", "From lettre"))
        .body("Your code is 482913".to_owned())?;
    let smtp_port: u16 = read_setting("SMTP_PORT", "1025").parse()?;
    SmtpTransport::builder_dangerous(read_setting("SMTP_HOST", "127.0.0.1"))
        .port(smtp_port)
        .build()
        .send(&message)?;
    Ok(())
}
