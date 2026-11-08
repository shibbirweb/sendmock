use sendmock_sms::{TwimlMessage, TwimlMethod, TwimlVerb, parse_twiml};
use sendmock_store::SmsReplyWebhookAttemptRecord;

use super::reply_webhook_failure::ReplyWebhookFailure;
use crate::sms::{HttpCallResult, RecordedHttpRequest, TwimlVerbView};
use crate::{OperationContext, OperationError};

const NO_SENDER_MESSAGE: &str = "this build cannot make HTTP calls";

/// Twilio reads these answers as TwiML (its Messaging TwiML docs, checked 2026-11-05).
const TWIML_CONTENT_TYPES: [&str; 3] = ["text/xml", "application/xml", "text/html"];

/// What one request to your app gave: the TwiML verbs to follow, or why there are none.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwimlFetch {
    pub verbs: Vec<TwimlVerb>,
    pub failure: Option<ReplyWebhookFailure>,
    pub status_code: Option<u16>,
}

/// One request an inbound message makes to your app, stored with what came back.
pub struct TwimlFetchRequest<'request> {
    pub inbound_sms_id: &'request str,
    pub webhook_request: &'request RecordedHttpRequest,
    pub is_fallback: bool,
}

/// Sends one request (the reply webhook, its fallback, a `<Redirect>` or an `action`), reads
/// the answer as Twilio does and stores the attempt with Twilio's error code and the verbs.
pub async fn fetch_twiml(
    operation_context: &OperationContext,
    fetch_request: &TwimlFetchRequest<'_>,
) -> Result<TwimlFetch, OperationError> {
    let created_at_unix_ms = operation_context.clock.now_unix_ms();
    let call_result = match &operation_context.reply_webhook_sender {
        Some(reply_webhook_sender) => {
            reply_webhook_sender
                .send_reply_webhook(fetch_request.webhook_request)
                .await
        }
        None => HttpCallResult {
            response: None,
            error_message: Some(NO_SENDER_MESSAGE.to_owned()),
            is_connection_failure: true,
            duration_ms: 0,
        },
    };
    let twiml_answer = read_twiml_answer(&call_result);
    if let Err(failure) = &twiml_answer {
        tracing::info!(
            url = fetch_request.webhook_request.url,
            error_code = failure.error_code(),
            "no TwiML reply: {}",
            failure.describe()
        );
    }
    let twiml_fetch = TwimlFetch {
        status_code: call_result
            .response
            .as_ref()
            .map(|response| response.status_code),
        verbs: twiml_answer.clone().unwrap_or_default(),
        failure: twiml_answer.err(),
    };
    operation_context
        .sms_reply_webhook_repository
        .insert_attempt(build_attempt_record(
            operation_context,
            fetch_request,
            &call_result,
            &twiml_fetch,
            created_at_unix_ms,
        ))
        .await?;
    Ok(twiml_fetch)
}

fn build_attempt_record(
    operation_context: &OperationContext,
    fetch_request: &TwimlFetchRequest<'_>,
    call_result: &HttpCallResult,
    twiml_fetch: &TwimlFetch,
    created_at_unix_ms: i64,
) -> SmsReplyWebhookAttemptRecord {
    let twiml_views: Vec<TwimlVerbView> =
        twiml_fetch.verbs.iter().map(TwimlVerbView::from).collect();
    SmsReplyWebhookAttemptRecord {
        attempt_id: operation_context.id_generator.generate_id().to_string(),
        sms_id: fetch_request.inbound_sms_id.to_owned(),
        is_fallback: fetch_request.is_fallback,
        request_json: serde_json::to_string(fetch_request.webhook_request).unwrap_or_default(),
        response_json: call_result
            .response
            .as_ref()
            .and_then(|response| serde_json::to_string(response).ok()),
        duration_ms: call_result
            .response
            .as_ref()
            .map(|_| call_result.duration_ms),
        error_code: twiml_fetch
            .failure
            .as_ref()
            .map(|failure| failure.error_code().to_owned()),
        error_message: twiml_fetch
            .failure
            .as_ref()
            .map(ReplyWebhookFailure::describe),
        twiml_json: serde_json::to_string(&twiml_views).unwrap_or_else(|_| "[]".to_owned()),
        created_at_unix_ms,
    }
}

/// The verbs of a `2xx` TwiML answer; an empty answer is a reply of nothing, and a
/// `text/plain` body is sent back to the sender as the reply, as Twilio does.
fn read_twiml_answer(call_result: &HttpCallResult) -> Result<Vec<TwimlVerb>, ReplyWebhookFailure> {
    let Some(response) = &call_result.response else {
        let detail = call_result
            .error_message
            .clone()
            .unwrap_or_else(|| "no answer".to_owned());
        if call_result.is_connection_failure {
            return Err(ReplyWebhookFailure::HttpConnection(detail));
        }
        return Err(ReplyWebhookFailure::HttpRetrieval(detail));
    };
    if !(200..=299).contains(&response.status_code) {
        return Err(ReplyWebhookFailure::HttpRetrieval(format!(
            "your app answered {}",
            response.status_code
        )));
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
    let media_type = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if TWIML_CONTENT_TYPES.contains(&media_type.as_str()) {
        return parse_twiml(&response.body)
            .map_err(|parse_error| ReplyWebhookFailure::DocumentParse(parse_error.to_string()));
    }
    if media_type == "text/plain" {
        return Ok(vec![build_plain_text_reply(&response.body)]);
    }
    let shown_content_type = if content_type.is_empty() {
        "none"
    } else {
        content_type
    };
    Err(ReplyWebhookFailure::InvalidContentType(
        shown_content_type.to_owned(),
    ))
}

fn build_plain_text_reply(reply_text: &str) -> TwimlVerb {
    TwimlVerb::Message(TwimlMessage {
        body: reply_text.trim().to_owned(),
        to: None,
        from: None,
        status_callback: None,
        action: None,
        method: TwimlMethod::Post,
        media_urls: Vec::new(),
    })
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
            is_connection_failure: false,
            duration_ms: 5,
        }
    }

    fn no_answer(error_message: &str, is_connection_failure: bool) -> HttpCallResult {
        HttpCallResult {
            response: None,
            error_message: Some(error_message.to_owned()),
            is_connection_failure,
            duration_ms: 1,
        }
    }

    fn read_error_code(call_result: &HttpCallResult) -> Option<&'static str> {
        read_twiml_answer(call_result)
            .err()
            .map(|failure| failure.error_code())
    }

    #[test]
    fn reads_xml_and_html_answers_as_twiml() {
        let twiml = "<Response><Message>Hi</Message></Response>";
        for content_type in ["text/xml", "application/xml; charset=utf-8", "text/html"] {
            let verbs = read_twiml_answer(&answer(200, content_type, twiml));
            assert_eq!(verbs.map(|verbs| verbs.len()), Ok(1), "{content_type}");
        }
    }

    #[test]
    fn an_empty_or_no_content_answer_is_no_reply() {
        assert_eq!(read_twiml_answer(&answer(204, "", "")), Ok(Vec::new()));
        assert_eq!(
            read_twiml_answer(&answer(200, "application/json", " ")),
            Ok(Vec::new())
        );
    }

    #[test]
    fn a_plain_text_answer_is_the_reply_text() {
        let verbs = read_twiml_answer(&answer(200, "text/plain", "See you at 9\n"));
        assert_eq!(verbs, Ok(vec![build_plain_text_reply("See you at 9")]));
    }

    #[test]
    fn failures_carry_twilios_error_codes() {
        assert_eq!(
            read_error_code(&answer(500, "text/xml", "<Response/>")),
            Some("11200")
        );
        assert_eq!(
            read_error_code(&no_answer("operation timed out", false)),
            Some("11200")
        );
        assert_eq!(
            read_error_code(&no_answer("connection refused", true)),
            Some("11205")
        );
        assert_eq!(
            read_error_code(&answer(200, "application/xml", "<Reply/>")),
            Some("12100")
        );
        assert_eq!(
            read_error_code(&answer(200, "text/html", "<h1>Hi</h1>")),
            Some("12100")
        );
        assert_eq!(
            read_error_code(&answer(200, "application/json", "{}")),
            Some("12300")
        );
        assert_eq!(
            read_twiml_answer(&answer(200, "", "<Response/>")),
            Err(ReplyWebhookFailure::InvalidContentType("none".to_owned()))
        );
    }
}
