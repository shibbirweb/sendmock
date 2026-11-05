//! Mailgun's route filters and the `stripped-*` fields, for routes on incoming email.

use std::collections::BTreeMap;
use std::sync::LazyLock;

use regex::Regex;

/// Which incoming emails a route takes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouteFilterRule {
    MatchRecipient {
        pattern: String,
    },
    MatchHeader {
        header_name: String,
        pattern: String,
    },
    CatchAll,
}

/// What a filter reads from an email: its recipients and headers.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RoutableEmail {
    pub recipients: Vec<String>,
    pub headers: BTreeMap<String, Vec<String>>,
}

/// The value that matched and the named groups it captured.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RouteFilterMatch {
    pub matched_value: String,
    pub captured_groups: BTreeMap<String, String>,
}

/// Mailgun matches from the start of the value and ignores case; `(?P<name>...)` names a
/// group, as in Python.
pub fn compile_route_pattern(pattern: &str) -> Option<Regex> {
    Regex::new(&format!("(?i)^(?:{pattern})")).ok()
}

/// Why a pattern cannot be used, or `None`.
pub fn find_route_pattern_error(pattern: &str) -> Option<&'static str> {
    if pattern.trim().is_empty() {
        return Some("Enter a pattern");
    }
    compile_route_pattern(pattern)
        .is_none()
        .then_some("Not a valid regular expression")
}

fn match_first(compiled_pattern: &Regex, candidate_values: &[String]) -> Option<RouteFilterMatch> {
    candidate_values.iter().find_map(|candidate_value| {
        let captures = compiled_pattern.captures(candidate_value)?;
        let captured_groups = compiled_pattern
            .capture_names()
            .flatten()
            .filter_map(|group_name| {
                captures
                    .name(group_name)
                    .map(|group_match| (group_name.to_owned(), group_match.as_str().to_owned()))
            })
            .collect();
        Some(RouteFilterMatch {
            matched_value: candidate_value.clone(),
            captured_groups,
        })
    })
}

/// Whether the filter takes the email, with what it captured (WH-12.1).
pub fn match_route_filter(
    filter_rule: &RouteFilterRule,
    routable_email: &RoutableEmail,
) -> Option<RouteFilterMatch> {
    let (pattern, candidate_values) = match filter_rule {
        RouteFilterRule::CatchAll => {
            return Some(RouteFilterMatch {
                matched_value: routable_email
                    .recipients
                    .first()
                    .cloned()
                    .unwrap_or_default(),
                captured_groups: BTreeMap::new(),
            });
        }
        RouteFilterRule::MatchRecipient { pattern } => (pattern, routable_email.recipients.clone()),
        RouteFilterRule::MatchHeader {
            header_name,
            pattern,
        } => (
            pattern,
            routable_email
                .headers
                .iter()
                .filter(|(candidate_name, _)| candidate_name.eq_ignore_ascii_case(header_name))
                .flat_map(|(_, header_values)| header_values.clone())
                .collect(),
        ),
    };
    match_first(&compile_route_pattern(pattern)?, &candidate_values)
}

static CAPTURED_GROUP_TOKEN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"\\g<(\w+)>").ok());

/// `\g<name>` in an action replaced with the captured group; unknown names stay as written.
pub fn fill_captured_groups(
    action_text: &str,
    captured_groups: &BTreeMap<String, String>,
) -> String {
    let Some(token_pattern) = CAPTURED_GROUP_TOKEN.as_ref() else {
        return action_text.to_owned();
    };
    token_pattern
        .replace_all(action_text, |token_captures: &regex::Captures<'_>| {
            captured_groups
                .get(&token_captures[1])
                .cloned()
                .unwrap_or_else(|| token_captures[0].to_owned())
        })
        .into_owned()
}

static QUOTE_INTRODUCTION: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"(?m)^\s*On .+wrote:\s*$").ok());

/// The new text of a reply and its signature: the quoted original (from its "On ... wrote:"
/// line) is left out, and the text after a `-- ` line is the signature (WH-12.3).
pub fn strip_reply_text(text_body: &str) -> (String, String) {
    let without_quote = QUOTE_INTRODUCTION
        .as_ref()
        .and_then(|quote_pattern| quote_pattern.find(text_body))
        .map_or(text_body, |quote_start| &text_body[..quote_start.start()]);
    let normalized_text = without_quote.replace("\r\n", "\n");
    match normalized_text.split_once("\n-- \n") {
        Some((stripped_text, signature)) => {
            (stripped_text.trim().to_owned(), signature.trim().to_owned())
        }
        None => (normalized_text.trim().to_owned(), String::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn email_to(recipients: &[&str]) -> RoutableEmail {
        RoutableEmail {
            recipients: recipients
                .iter()
                .map(|recipient| (*recipient).to_owned())
                .collect(),
            headers: BTreeMap::from([("Subject".to_owned(), vec!["Order 42 help".to_owned()])]),
        }
    }

    // AC: WH-12.1
    #[test]
    fn match_recipient_captures_named_groups_for_the_actions() {
        let filter_rule = RouteFilterRule::MatchRecipient {
            pattern: r"reply\+(?P<ticket>\d+)@reply\.app\.test".to_owned(),
        };

        let route_match = match_route_filter(&filter_rule, &email_to(&["REPLY+42@reply.app.test"]));

        let captured_groups = route_match
            .map(|route_match| route_match.captured_groups)
            .unwrap_or_default();
        assert_eq!(
            captured_groups.get("ticket").map(String::as_str),
            Some("42")
        );
        assert_eq!(
            fill_captured_groups(
                r"https://app.test/tickets/\g<ticket>/mail",
                &captured_groups
            ),
            "https://app.test/tickets/42/mail"
        );
    }

    // AC: WH-12.1
    #[test]
    fn match_header_and_catch_all_take_what_they_should() {
        let header_rule = RouteFilterRule::MatchHeader {
            header_name: "subject".to_owned(),
            pattern: ".*help".to_owned(),
        };
        let other_header_rule = RouteFilterRule::MatchHeader {
            header_name: "subject".to_owned(),
            pattern: "invoice".to_owned(),
        };

        assert!(match_route_filter(&header_rule, &email_to(&["a@b.test"])).is_some());
        assert!(match_route_filter(&other_header_rule, &email_to(&["a@b.test"])).is_none());
        assert!(match_route_filter(&RouteFilterRule::CatchAll, &email_to(&[])).is_some());
        assert_eq!(
            find_route_pattern_error("(unclosed"),
            Some("Not a valid regular expression")
        );
    }

    // AC: WH-12.3
    #[test]
    fn stripped_text_leaves_out_the_quote_and_the_signature() {
        let reply_text = "Thanks, it arrived.\n-- \nSam\nQA lead\n\nOn Thu, 01 Jan 2026 00:00:00 GMT, Shop <shop@example.test> wrote:\n> Your order shipped";

        assert_eq!(
            strip_reply_text(reply_text),
            ("Thanks, it arrived.".to_owned(), "Sam\nQA lead".to_owned())
        );
    }
}
