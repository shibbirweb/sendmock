//! Mailgun's route syntax read back into a filter and actions, for the Routes API
//! (`expression` and each `action` field).

use super::route_wire::{InboundRouteAction, InboundRouteFilter};

/// The call name and its arguments: `forward("a", "b")` is `("forward", ["a", "b"])`;
/// `store(notify="url")` keeps the argument's value.
fn parse_call(expression: &str) -> Option<(String, Vec<String>)> {
    let expression = expression.trim();
    let (call_name, rest) = expression.split_once('(')?;
    let arguments_text = rest.trim_end().strip_suffix(')')?;
    let mut arguments = Vec::new();
    let mut characters = arguments_text.chars().peekable();
    while let Some(character) = characters.next() {
        if character != '"' {
            continue;
        }
        let mut argument = String::new();
        while let Some(quoted_character) = characters.next() {
            match quoted_character {
                '\\' if characters.peek() == Some(&'"') => {
                    argument.push('"');
                    characters.next();
                }
                '"' => break,
                _ => argument.push(quoted_character),
            }
        }
        arguments.push(argument);
    }
    Some((call_name.trim().to_ascii_lowercase(), arguments))
}

pub fn parse_route_expression(expression: &str) -> Option<InboundRouteFilter> {
    let (call_name, mut arguments) = parse_call(expression)?;
    match (call_name.as_str(), arguments.len()) {
        ("match_recipient", 1) => Some(InboundRouteFilter::MatchRecipient {
            pattern: arguments.remove(0),
        }),
        ("match_header", 2) => Some(InboundRouteFilter::MatchHeader {
            header_name: arguments.remove(0),
            pattern: arguments.remove(0),
        }),
        ("catch_all", 0) => Some(InboundRouteFilter::CatchAll),
        _ => None,
    }
}

/// `forward(...)` takes a URL or an address, as Mailgun's does.
pub fn parse_route_action(action_expression: &str) -> Option<InboundRouteAction> {
    let (call_name, mut arguments) = parse_call(action_expression)?;
    match (call_name.as_str(), arguments.len()) {
        ("forward", 1) => {
            let destination = arguments.remove(0);
            Some(
                if destination.starts_with("http://") || destination.starts_with("https://") {
                    InboundRouteAction::ForwardUrl { url: destination }
                } else {
                    InboundRouteAction::ForwardEmail {
                        address: destination,
                    }
                },
            )
        }
        ("store", 0) => Some(InboundRouteAction::Store { notify_url: None }),
        ("store", 1) => Some(InboundRouteAction::Store {
            notify_url: Some(arguments.remove(0)),
        }),
        ("stop", 0) => Some(InboundRouteAction::Stop),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-12.6
    #[test]
    fn reads_mailgun_filters_and_actions() {
        assert_eq!(
            parse_route_expression(r#"match_header("subject", "say \"hi\"")"#),
            Some(InboundRouteFilter::MatchHeader {
                header_name: "subject".to_owned(),
                pattern: "say \"hi\"".to_owned(),
            })
        );
        assert_eq!(
            parse_route_expression("catch_all()"),
            Some(InboundRouteFilter::CatchAll)
        );
        assert_eq!(
            parse_route_action(r#"forward("http://localhost:8000/mail")"#),
            Some(InboundRouteAction::ForwardUrl {
                url: "http://localhost:8000/mail".to_owned()
            })
        );
        assert_eq!(
            parse_route_action(r#"forward("qa@example.test")"#),
            Some(InboundRouteAction::ForwardEmail {
                address: "qa@example.test".to_owned()
            })
        );
        assert_eq!(
            parse_route_action(r#"store(notify="http://localhost:8000/stored")"#),
            Some(InboundRouteAction::Store {
                notify_url: Some("http://localhost:8000/stored".to_owned())
            })
        );
        assert_eq!(parse_route_action("stop()"), Some(InboundRouteAction::Stop));
        assert_eq!(parse_route_action("explode()"), None);
    }
}
