use std::io::{self, BufRead, BufReader, Write};
use std::net::TcpStream;

use sendmock_smtp::encode_base64_text;

/// How the client logs in: the credentials in one AUTH PLAIN line, or AUTH LOGIN's two
/// challenges.
#[derive(Debug, Clone, Copy)]
pub enum SmtpLogin {
    Plain,
    Login,
}

/// Sends one line (or nothing, for the greeting) and answers the reply's code.
fn exchange(reader: &mut BufReader<TcpStream>, line: Option<&str>) -> io::Result<u16> {
    if let Some(line) = line {
        reader
            .get_mut()
            .write_all(format!("{line}\r\n").as_bytes())?;
    }
    loop {
        let mut reply_line = String::new();
        if reader.read_line(&mut reply_line)? == 0 {
            return Err(io::Error::other("the server closed the connection"));
        }
        if reply_line.as_bytes().get(3) != Some(&b'-') {
            return Ok(reply_line
                .get(..3)
                .and_then(|code| code.parse().ok())
                .unwrap_or_default());
        }
    }
}

fn expect_code(
    reader: &mut BufReader<TcpStream>,
    line: Option<&str>,
    expected_code: u16,
) -> io::Result<()> {
    let reply_code = exchange(reader, line)?;
    if reply_code == expected_code {
        return Ok(());
    }
    Err(io::Error::other(format!(
        "{} answered {reply_code}, not {expected_code}",
        line.map_or("the greeting", |line| line
            .split(' ')
            .next()
            .unwrap_or(line))
    )))
}

/// Logs in with `username` and `password`, then sends one short message to `dev@example.com`.
pub fn send_mail_with_auth(
    smtp_addr: &str,
    smtp_login: SmtpLogin,
    username: &str,
    password: &str,
) -> io::Result<()> {
    let mut reader = BufReader::new(TcpStream::connect(smtp_addr)?);
    expect_code(&mut reader, None, 220)?;
    expect_code(&mut reader, Some("EHLO sweep.test"), 250)?;
    match smtp_login {
        SmtpLogin::Plain => {
            let plain_login = encode_base64_text(&format!("\0{username}\0{password}"));
            expect_code(&mut reader, Some(&format!("AUTH PLAIN {plain_login}")), 235)?;
        }
        SmtpLogin::Login => {
            expect_code(&mut reader, Some("AUTH LOGIN"), 334)?;
            expect_code(&mut reader, Some(&encode_base64_text(username)), 334)?;
            expect_code(&mut reader, Some(&encode_base64_text(password)), 235)?;
        }
    }
    expect_code(&mut reader, Some("MAIL FROM:<app@example.com>"), 250)?;
    expect_code(&mut reader, Some("RCPT TO:<dev@example.com>"), 250)?;
    expect_code(&mut reader, Some("DATA"), 354)?;
    expect_code(
        &mut reader,
        Some(&format!(
            "From: app@example.com\r\nTo: dev@example.com\r\nSubject: Sent with {smtp_login:?}\r\n\r\nHello.\r\n."
        )),
        250,
    )?;
    expect_code(&mut reader, Some("QUIT"), 221)
}
