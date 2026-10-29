/// What a `sendmail` command line asks for; options SendMock has no use for are accepted
/// and ignored, as PHP, cron and other callers pass them.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SendmailArguments {
    /// `-t`: take the recipients from the To, Cc and Bcc headers.
    pub reads_recipients_from_headers: bool,
    /// `-f` (or `-r`): the envelope sender.
    pub envelope_sender: Option<String>,
    pub recipients: Vec<String>,
}

/// Options that take the next argument as their value when it is not attached.
const OPTIONS_WITH_VALUES: [&str; 5] = ["-f", "-r", "-F", "-O", "-B"];

pub fn parse_sendmail_arguments<Argument: AsRef<str>>(arguments: &[Argument]) -> SendmailArguments {
    let mut sendmail_arguments = SendmailArguments::default();
    let mut remaining_arguments = arguments.iter().map(AsRef::as_ref);
    let mut has_ended_options = false;
    while let Some(argument) = remaining_arguments.next() {
        if has_ended_options || !argument.starts_with('-') {
            sendmail_arguments
                .recipients
                .extend(split_recipients(argument));
            continue;
        }
        if argument == "--" {
            has_ended_options = true;
            continue;
        }
        if argument == "-t" {
            sendmail_arguments.reads_recipients_from_headers = true;
            continue;
        }
        let option_name = argument.get(..2).unwrap_or(argument);
        if !OPTIONS_WITH_VALUES.contains(&option_name) {
            continue;
        }
        let attached_value = &argument[option_name.len()..];
        let option_value = if attached_value.is_empty() {
            remaining_arguments.next().unwrap_or_default()
        } else {
            attached_value
        };
        if matches!(option_name, "-f" | "-r") && !option_value.is_empty() {
            sendmail_arguments.envelope_sender = Some(option_value.to_owned());
        }
    }
    sendmail_arguments
}

fn split_recipients(argument: &str) -> impl Iterator<Item = String> + '_ {
    argument
        .split(',')
        .map(str::trim)
        .filter(|recipient| !recipient.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_what_php_mail_passes() {
        assert_eq!(
            parse_sendmail_arguments(&["-t", "-i"]),
            SendmailArguments {
                reads_recipients_from_headers: true,
                ..SendmailArguments::default()
            }
        );
    }

    // AC: EM-06.3
    #[test]
    fn takes_the_sender_attached_or_separate_and_the_recipients() {
        let attached = parse_sendmail_arguments(&["-fapp@shop.test", "-oi", "sam@example.test"]);
        let separate =
            parse_sendmail_arguments(&["-f", "app@shop.test", "-F", "Shop", "a@x.test,b@y.test"]);

        assert_eq!(attached.envelope_sender.as_deref(), Some("app@shop.test"));
        assert_eq!(attached.recipients, ["sam@example.test"]);
        assert_eq!(separate.envelope_sender.as_deref(), Some("app@shop.test"));
        assert_eq!(separate.recipients, ["a@x.test", "b@y.test"]);
    }

    #[test]
    fn everything_after_a_double_dash_is_a_recipient() {
        assert_eq!(
            parse_sendmail_arguments(&["--", "-odd@example.test"]).recipients,
            ["-odd@example.test"]
        );
    }
}
