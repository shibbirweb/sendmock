/// One command line from the client, read into what the session needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SmtpCommand {
    Hello {
        is_extended: bool,
        client_name: String,
    },
    Mail {
        reverse_path: String,
        declared_size: Option<u64>,
    },
    Recipient {
        forward_path: String,
    },
    Data,
    Reset,
    Noop,
    Quit,
    Verify,
    StartTls,
    Auth {
        mechanism: String,
        initial_response: Option<String>,
    },
    /// A known command with arguments that do not parse, with the reason.
    InvalidArguments(&'static str),
    Unknown,
}

pub fn parse_smtp_command(command_line: &str) -> SmtpCommand {
    let (verb, arguments) = command_line.split_once(' ').unwrap_or((command_line, ""));
    let arguments = arguments.trim();
    match verb.to_ascii_uppercase().as_str() {
        "EHLO" | "HELO" if arguments.is_empty() => {
            SmtpCommand::InvalidArguments("EHLO and HELO need the client's name")
        }
        "EHLO" => SmtpCommand::Hello {
            is_extended: true,
            client_name: arguments.to_owned(),
        },
        "HELO" => SmtpCommand::Hello {
            is_extended: false,
            client_name: arguments.to_owned(),
        },
        "MAIL" => parse_mail_arguments(arguments),
        "RCPT" => match read_path(arguments, "TO:") {
            Some((forward_path, _)) if !forward_path.is_empty() => {
                SmtpCommand::Recipient { forward_path }
            }
            _ => SmtpCommand::InvalidArguments("Write RCPT TO:<address>"),
        },
        "DATA" => SmtpCommand::Data,
        "RSET" => SmtpCommand::Reset,
        "NOOP" => SmtpCommand::Noop,
        "QUIT" => SmtpCommand::Quit,
        "VRFY" => SmtpCommand::Verify,
        "STARTTLS" => SmtpCommand::StartTls,
        "AUTH" => parse_auth_arguments(arguments),
        _ => SmtpCommand::Unknown,
    }
}

fn parse_mail_arguments(arguments: &str) -> SmtpCommand {
    let Some((reverse_path, parameters)) = read_path(arguments, "FROM:") else {
        return SmtpCommand::InvalidArguments("Write MAIL FROM:<address>");
    };
    let mut declared_size = None;
    for parameter in parameters.split_whitespace() {
        if let Some(size_text) = parameter.to_ascii_uppercase().strip_prefix("SIZE=") {
            match size_text.parse::<u64>() {
                Ok(size_bytes) => declared_size = Some(size_bytes),
                Err(_) => return SmtpCommand::InvalidArguments("SIZE must be a number of bytes"),
            }
        }
    }
    SmtpCommand::Mail {
        reverse_path,
        declared_size,
    }
}

fn parse_auth_arguments(arguments: &str) -> SmtpCommand {
    let mut parts = arguments.split_whitespace();
    match parts.next() {
        Some(mechanism) => SmtpCommand::Auth {
            mechanism: mechanism.to_ascii_uppercase(),
            initial_response: parts.next().map(str::to_owned),
        },
        None => SmtpCommand::InvalidArguments("Name an AUTH mechanism"),
    }
}

/// `FROM:<a@b.test> SIZE=10` gives the address and the parameters after it. The `<>` null
/// sender is an empty address.
fn read_path<'arguments>(
    arguments: &'arguments str,
    prefix: &str,
) -> Option<(String, &'arguments str)> {
    let after_prefix = arguments
        .get(..prefix.len())
        .filter(|start| start.eq_ignore_ascii_case(prefix))
        .map(|_| &arguments[prefix.len()..])?;
    let after_prefix = after_prefix.trim_start();
    match after_prefix.strip_prefix('<') {
        Some(inside) => {
            let (path, rest) = inside.split_once('>')?;
            Some((path.trim().to_owned(), rest.trim()))
        }
        None => {
            let (path, rest) = after_prefix.split_once(' ').unwrap_or((after_prefix, ""));
            Some((path.to_owned(), rest.trim()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_commands_case_insensitively() {
        assert_eq!(
            parse_smtp_command("ehlo app.test"),
            SmtpCommand::Hello {
                is_extended: true,
                client_name: "app.test".to_owned()
            }
        );
        assert_eq!(parse_smtp_command("QUIT"), SmtpCommand::Quit);
        assert_eq!(parse_smtp_command("starttls"), SmtpCommand::StartTls);
    }

    #[test]
    fn reads_mail_with_its_size_and_the_null_sender() {
        assert_eq!(
            parse_smtp_command("MAIL FROM:<app@shop.test> SIZE=2048 BODY=8BITMIME SMTPUTF8"),
            SmtpCommand::Mail {
                reverse_path: "app@shop.test".to_owned(),
                declared_size: Some(2048)
            }
        );
        assert_eq!(
            parse_smtp_command("MAIL FROM:<>"),
            SmtpCommand::Mail {
                reverse_path: String::new(),
                declared_size: None
            }
        );
    }

    #[test]
    fn reads_recipients_and_auth() {
        assert_eq!(
            parse_smtp_command("RCPT TO:<sam@example.test>"),
            SmtpCommand::Recipient {
                forward_path: "sam@example.test".to_owned()
            }
        );
        assert_eq!(
            parse_smtp_command("AUTH plain AGFwcABzZWNyZXQ="),
            SmtpCommand::Auth {
                mechanism: "PLAIN".to_owned(),
                initial_response: Some("AGFwcABzZWNyZXQ=".to_owned())
            }
        );
    }

    #[test]
    fn names_what_is_wrong_with_bad_arguments() {
        assert!(matches!(
            parse_smtp_command("MAIL TO:<x@y.test>"),
            SmtpCommand::InvalidArguments(_)
        ));
        assert!(matches!(
            parse_smtp_command("RCPT TO:<>"),
            SmtpCommand::InvalidArguments(_)
        ));
        assert!(matches!(
            parse_smtp_command("EHLO"),
            SmtpCommand::InvalidArguments(_)
        ));
        assert_eq!(parse_smtp_command("FROB"), SmtpCommand::Unknown);
    }
}
