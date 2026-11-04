use sendmock_sms::{TwimlVerb, parse_twiml};

use crate::OperationContext;
use crate::sms::{HttpCallResult, RecordedHttpRequest};

/// Sends one reply webhook request (the first, a `<Redirect>` or an `action`) and reads the
/// answer as TwiML. An answer that holds no reply (an empty body, `204`, or a failure) gives
/// no verbs; the reason is logged.
pub async fn fetch_twiml_verbs(
    operation_context: &OperationContext,
    webhook_request: &RecordedHttpRequest,
) -> Vec<TwimlVerb> {
    let Some(reply_webhook_sender) = &operation_context.reply_webhook_sender else {
        tracing::warn!(
            url = webhook_request.url,
            "this build cannot make HTTP calls, so the reply webhook was not sent"
        );
        return Vec::new();
    };
    let call_result = reply_webhook_sender
        .send_reply_webhook(webhook_request)
        .await;
    match read_twiml_verbs(&call_result) {
        Ok(twiml_verbs) => twiml_verbs,
        Err(problem) => {
            tracing::info!(url = webhook_request.url, problem, "no TwiML reply");
            Vec::new()
        }
    }
}

/// The verbs of a `2xx` XML answer; an empty answer is a reply of nothing.
fn read_twiml_verbs(call_result: &HttpCallResult) -> Result<Vec<TwimlVerb>, String> {
    let Some(response) = &call_result.response else {
        return Err(call_result
            .error_message
            .clone()
            .unwrap_or_else(|| "no answer".to_owned()));
    };
    if !(200..=299).contains(&response.status_code) {
        return Err(format!("your app answered {}", response.status_code));
    }
    if response.status_code == 204 || response.body.trim().is_empty() {
        return Ok(Vec::new());
    }
    let content_type = response
        .headers
        .iter()
        .find(|(header_name, _)| header_name.eq_ignore_ascii_case("content-type"))
        .map(|(_, header_value)| header_value.as_str())
        .unwrap_or_default();
    if !content_type.to_ascii_lowercase().contains("xml") {
        return Err(format!("the answer is {content_type}, not TwiML"));
    }
    parse_twiml(&response.body).map_err(|parse_error| parse_error.to_string())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::sms::RecordedHttpResponse;

    fn answer(status_code: u16, content_type: &str, body: &str) -> HttpCallResult {
        HttpCallResult {
            response: Some(RecordedHttpResponse {
                status_code,
                headers: BTreeMap::from([("content-type".to_owned(), content_type.to_owned())]),
                body: body.to_owned(),
                is_body_truncated: false,
            }),
            error_message: None,
            duration_ms: 5,
        }
    }

    #[test]
    fn reads_the_verbs_of_an_xml_answer() {
        let call_result = answer(
            200,
            "text/xml",
            "<Response><Message>Hi</Message></Response>",
        );
        assert_eq!(
            read_twiml_verbs(&call_result).map(|verbs| verbs.len()),
            Ok(1)
        );
    }

    #[test]
    fn an_empty_or_no_content_answer_is_no_reply() {
        assert_eq!(read_twiml_verbs(&answer(204, "", "")), Ok(Vec::new()));
        assert_eq!(
            read_twiml_verbs(&answer(200, "text/plain", " ")),
            Ok(Vec::new())
        );
    }

    #[test]
    fn failures_and_other_content_give_no_verbs() {
        assert!(read_twiml_verbs(&answer(500, "text/xml", "<Response/>")).is_err());
        assert!(read_twiml_verbs(&answer(200, "application/json", "{}")).is_err());
        assert!(read_twiml_verbs(&answer(200, "application/xml", "<Reply/>")).is_err());
        let refused = HttpCallResult {
            response: None,
            error_message: Some("connection refused".to_owned()),
            duration_ms: 1,
        };
        assert_eq!(
            read_twiml_verbs(&refused),
            Err("connection refused".to_owned())
        );
    }
}
