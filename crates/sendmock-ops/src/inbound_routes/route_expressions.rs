//! Routes written in Mailgun's syntax, as the list and the Routes API show them.

use super::route_wire::{InboundRouteAction, InboundRouteFilter};

/// Mailgun writes the regex as typed, escaping only quotes.
fn quote(text: &str) -> String {
    format!("\"{}\"", text.replace('"', "\\\""))
}

pub fn to_route_expression(route_filter: &InboundRouteFilter) -> String {
    match route_filter {
        InboundRouteFilter::MatchRecipient { pattern } => {
            format!("match_recipient({})", quote(pattern))
        }
        InboundRouteFilter::MatchHeader {
            header_name,
            pattern,
        } => format!("match_header({}, {})", quote(header_name), quote(pattern)),
        InboundRouteFilter::CatchAll => "catch_all()".to_owned(),
    }
}

pub fn to_action_expression(route_action: &InboundRouteAction) -> String {
    match route_action {
        InboundRouteAction::ForwardUrl { url } => format!("forward({})", quote(url)),
        InboundRouteAction::ForwardEmail { address } => format!("forward({})", quote(address)),
        InboundRouteAction::Store { notify_url } => match notify_url.as_deref() {
            None | Some("") => "store()".to_owned(),
            Some(notify_url) => format!("store(notify={})", quote(notify_url)),
        },
        InboundRouteAction::Stop => "stop()".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-12.7
    #[test]
    fn writes_filters_and_actions_in_mailgun_syntax() {
        assert_eq!(
            to_route_expression(&InboundRouteFilter::MatchHeader {
                header_name: "subject".to_owned(),
                pattern: "say \"hi\"".to_owned(),
            }),
            r#"match_header("subject", "say \"hi\"")"#
        );
        assert_eq!(
            to_action_expression(&InboundRouteAction::Store {
                notify_url: Some("http://localhost:8000/stored".to_owned()),
            }),
            r#"store(notify="http://localhost:8000/stored")"#
        );
        assert_eq!(to_action_expression(&InboundRouteAction::Stop), "stop()");
    }
}
