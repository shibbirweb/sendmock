//! SpamAssassin's `spamd` protocol (SPAMC/1.5): the `REPORT` request and its reply.

use std::sync::LazyLock;

use regex::Regex;

/// One rule the message triggered, as spamd's report lists it.
#[derive(Debug, Clone, PartialEq)]
pub struct SpamdRule {
    pub name: String,
    pub score: f64,
    pub description: String,
}

/// What spamd answered for one message.
#[derive(Debug, Clone, PartialEq)]
pub struct SpamdReport {
    pub score: f64,
    pub threshold: f64,
    pub rules: Vec<SpamdRule>,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SpamdReplyError {
    #[error("spamd refused the message: {0}")]
    Refused(String),
    #[error("spamd's reply could not be read: {0}")]
    Unreadable(&'static str),
}

static RULE_LINE_PATTERN: LazyLock<Option<Regex>> =
    LazyLock::new(|| Regex::new(r"^\s*(-?\d+(?:\.\d+)?)\s+([A-Za-z0-9_]+)\s+(.*)$").ok());

/// The bytes to write to spamd for a `REPORT` of the raw message.
pub fn build_spamd_report_request(raw_message: &[u8]) -> Vec<u8> {
    let mut request = format!(
        "REPORT SPAMC/1.5\r\nContent-length: {}\r\n\r\n",
        raw_message.len()
    )
    .into_bytes();
    request.extend_from_slice(raw_message);
    request
}

/// Reads spamd's whole reply: the status line, the `Spam: <bool> ; <score> / <threshold>`
/// header and the rule table of the report body.
pub fn parse_spamd_reply(reply: &[u8]) -> Result<SpamdReport, SpamdReplyError> {
    let reply_text = String::from_utf8_lossy(reply);
    let (head, report_body) = reply_text
        .split_once("\r\n\r\n")
        .or_else(|| reply_text.split_once("\n\n"))
        .unwrap_or((&reply_text, ""));
    let mut head_lines = head.lines();
    let status_line = head_lines
        .next()
        .ok_or(SpamdReplyError::Unreadable("the reply is empty"))?;
    check_status_line(status_line)?;
    let spam_header = head_lines
        .filter_map(|header_line| header_line.split_once(':'))
        .find(|(header_name, _)| header_name.trim().eq_ignore_ascii_case("spam"))
        .map(|(_, header_value)| header_value)
        .ok_or(SpamdReplyError::Unreadable("the Spam header is missing"))?;
    let (score, threshold) = parse_spam_header(spam_header)
        .ok_or(SpamdReplyError::Unreadable("the Spam header has no score"))?;
    Ok(SpamdReport {
        score,
        threshold,
        rules: parse_rule_table(report_body),
    })
}

/// `SPAMD/1.1 0 EX_OK`; any other code is a refusal with spamd's own words.
fn check_status_line(status_line: &str) -> Result<(), SpamdReplyError> {
    let mut status_parts = status_line.trim().splitn(3, ' ');
    let protocol = status_parts.next().unwrap_or_default();
    let status_code = status_parts.next().unwrap_or_default();
    if !protocol.starts_with("SPAMD/") {
        return Err(SpamdReplyError::Unreadable("the reply is not from spamd"));
    }
    if status_code != "0" {
        return Err(SpamdReplyError::Refused(
            status_parts.next().unwrap_or(status_code).to_owned(),
        ));
    }
    Ok(())
}

/// ` True ; 15.0 / 5.0`
fn parse_spam_header(header_value: &str) -> Option<(f64, f64)> {
    let (_, scores) = header_value.split_once(';')?;
    let (score_text, threshold_text) = scores.split_once('/')?;
    Some((
        score_text.trim().parse().ok()?,
        threshold_text.trim().parse().ok()?,
    ))
}

/// The rows under the `---- ----` ruler; an indented row without a score continues the
/// description above it.
fn parse_rule_table(report_body: &str) -> Vec<SpamdRule> {
    let Some(rule_pattern) = RULE_LINE_PATTERN.as_ref() else {
        return Vec::new();
    };
    let mut rules: Vec<SpamdRule> = Vec::new();
    let table_lines = report_body
        .lines()
        .skip_while(|report_line| !report_line.trim_start().starts_with("----"))
        .skip(1);
    for table_line in table_lines {
        if let Some(rule_captures) = rule_pattern.captures(table_line) {
            rules.push(SpamdRule {
                name: rule_captures[2].to_owned(),
                score: rule_captures[1].parse().unwrap_or_default(),
                description: rule_captures[3].trim().to_owned(),
            });
        } else if let Some(previous_rule) = rules.last_mut()
            && table_line.starts_with(char::is_whitespace)
            && !table_line.trim().is_empty()
        {
            previous_rule.description.push(' ');
            previous_rule.description.push_str(table_line.trim());
        } else if table_line.trim().is_empty() && !rules.is_empty() {
            break;
        }
    }
    rules
}

#[cfg(test)]
mod tests {
    use super::*;

    const SPAMD_REPORT_REPLY: &str = "SPAMD/1.1 0 EX_OK\r\nContent-length: 600\r\nSpam: False ; 2.7 / 5.0\r\n\r\nSpam detection software, running on the system \"spamd\", has NOT identified\nthis incoming email as spam.\n\nContent preview:  Hello [...]\n\nContent analysis details:   (2.7 points, 5.0 required)\n\n pts rule name              description\n---- ---------------------- --------------------------------------------------\n-0.0 NO_RELAYS              Informational: message was not relayed via SMTP\n 1.4 MISSING_DATE           Missing Date: header\n 1.2 HTML_IMAGE_ONLY_08     BODY: HTML: images with 0-800 bytes of words\n                            in the message body\n\n";

    #[test]
    fn the_report_request_names_the_length_of_the_message() {
        let request = build_spamd_report_request(b"Subject: Hi\r\n\r\nHello");

        assert_eq!(
            String::from_utf8_lossy(&request),
            "REPORT SPAMC/1.5\r\nContent-length: 20\r\n\r\nSubject: Hi\r\n\r\nHello"
        );
    }

    // AC: EM-13.3
    #[test]
    fn reads_the_score_the_threshold_and_every_rule_with_wrapped_descriptions() {
        let report = parse_spamd_reply(SPAMD_REPORT_REPLY.as_bytes());

        assert_eq!(
            report,
            Ok(SpamdReport {
                score: 2.7,
                threshold: 5.0,
                rules: vec![
                    SpamdRule {
                        name: "NO_RELAYS".to_owned(),
                        score: -0.0,
                        description: "Informational: message was not relayed via SMTP".to_owned(),
                    },
                    SpamdRule {
                        name: "MISSING_DATE".to_owned(),
                        score: 1.4,
                        description: "Missing Date: header".to_owned(),
                    },
                    SpamdRule {
                        name: "HTML_IMAGE_ONLY_08".to_owned(),
                        score: 1.2,
                        description:
                            "BODY: HTML: images with 0-800 bytes of words in the message body"
                                .to_owned(),
                    },
                ],
            })
        );
    }

    #[test]
    fn a_refusal_and_a_reply_from_something_else_are_errors() {
        assert_eq!(
            parse_spamd_reply(b"SPAMD/1.0 76 Bad header line: GARBAGE\r\n\r\n"),
            Err(SpamdReplyError::Refused(
                "Bad header line: GARBAGE".to_owned()
            ))
        );
        assert_eq!(
            parse_spamd_reply(b"HTTP/1.1 400 Bad Request\r\n\r\n"),
            Err(SpamdReplyError::Unreadable("the reply is not from spamd"))
        );
        assert_eq!(
            parse_spamd_reply(b"SPAMD/1.1 0 EX_OK\r\n\r\n"),
            Err(SpamdReplyError::Unreadable("the Spam header is missing"))
        );
    }
}
