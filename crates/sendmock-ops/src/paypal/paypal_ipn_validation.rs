use crate::providers::ProviderHttpResponse;
use crate::{OperationContext, OperationError, RecordedHttpRequest};

const IPN_POSTBACK_PATH: &str = "/cgi-bin/webscr";
const NOTIFY_VALIDATE_FIELD: (&str, &str) = ("cmd", "_notify-validate");
/// The fields that tell an IPN apart, most specific first.
const IPN_LOOKUP_FIELDS: [&str; 3] = ["ipn_track_id", "verify_sign", "txn_id"];
/// An IPN's track id is unique, so more than a few deliveries carrying it means replays.
const MAXIMUM_CANDIDATES: u32 = 20;

type FormFields = Vec<(String, String)>;

/// Whether the request is an IPN postback: PayPal serves it at `/cgi-bin/webscr` on its IPN
/// and website hosts alike.
pub fn is_ipn_postback_path(request_path: &str) -> bool {
    request_path.trim_end_matches('/') == IPN_POSTBACK_PATH
}

/// The fields in the order they were written, each value decoded.
fn read_form_fields(form_text: &[u8]) -> Option<FormFields> {
    serde_urlencoded::from_bytes(form_text).ok()
}

/// The message the app posts back after `cmd=_notify-validate`; none without that command first.
fn read_posted_message(postback_body: &[u8]) -> Option<FormFields> {
    let mut posted_fields = read_form_fields(postback_body)?;
    let is_validate_command = posted_fields
        .first()
        .is_some_and(|(field_name, field_value)| {
            (field_name.as_str(), field_value.as_str()) == NOTIFY_VALIDATE_FIELD
        });
    if !is_validate_command {
        return None;
    }
    posted_fields.remove(0);
    Some(posted_fields).filter(|message_fields| !message_fields.is_empty())
}

fn read_lookup_value(message_fields: &FormFields) -> Option<&str> {
    IPN_LOOKUP_FIELDS.iter().find_map(|lookup_field| {
        message_fields
            .iter()
            .find(|(field_name, field_value)| field_name == lookup_field && !field_value.is_empty())
            .map(|(_, field_value)| field_value.as_str())
    })
}

fn is_sent_message(rendered_request_json: &str, message_fields: &FormFields) -> bool {
    serde_json::from_str::<RecordedHttpRequest>(rendered_request_json)
        .ok()
        .and_then(|rendered_request| read_form_fields(rendered_request.body.as_bytes()))
        .is_some_and(|sent_fields| &sent_fields == message_fields)
}

/// Whether SendMock queued exactly this message: the same fields in the same order with the
/// same values, as PayPal checks an IPN it sent.
pub async fn is_genuine_ipn(
    operation_context: &OperationContext,
    postback_body: &[u8],
) -> Result<bool, OperationError> {
    let Some(message_fields) = read_posted_message(postback_body) else {
        return Ok(false);
    };
    let Some(lookup_value) = read_lookup_value(&message_fields) else {
        return Ok(false);
    };
    let candidate_deliveries = operation_context
        .webhook_delivery_repository
        .list_first_attempts_containing(lookup_value, MAXIMUM_CANDIDATES)
        .await
        .map_err(OperationError::from)?;
    Ok(candidate_deliveries.iter().any(|candidate_delivery| {
        candidate_delivery
            .rendered_request_json
            .as_deref()
            .is_some_and(|request_json| is_sent_message(request_json, &message_fields))
    }))
}

/// PayPal's postback answer: the single word `VERIFIED` or `INVALID`, always with 200.
pub fn build_ipn_response(is_verified: bool) -> ProviderHttpResponse {
    ProviderHttpResponse {
        status: 200,
        headers: vec![(
            "Content-Type".to_owned(),
            "text/plain; charset=UTF-8".to_owned(),
        )],
        body: if is_verified { "VERIFIED" } else { "INVALID" }.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_message_follows_the_validate_command_with_its_values_decoded() {
        let message_fields = read_posted_message(
            b"cmd=_notify-validate&payment_status=Completed&item_name=Blue%20mug+set",
        )
        .unwrap_or_default();

        assert_eq!(
            message_fields,
            vec![
                ("payment_status".to_owned(), "Completed".to_owned()),
                ("item_name".to_owned(), "Blue mug set".to_owned()),
            ]
        );
    }

    #[test]
    fn a_postback_without_the_command_first_or_without_a_message_is_not_read() {
        assert!(read_posted_message(b"payment_status=Completed&cmd=_notify-validate").is_none());
        assert!(read_posted_message(b"cmd=_notify-synch&tx=123").is_none());
        assert!(read_posted_message(b"cmd=_notify-validate").is_none());
    }

    #[test]
    fn the_track_id_is_looked_up_first_then_the_signature_then_the_transaction() {
        let pair =
            |field_name: &str, field_value: &str| (field_name.to_owned(), field_value.to_owned());

        let with_all = vec![
            pair("txn_id", "9AB"),
            pair("verify_sign", "Sig"),
            pair("ipn_track_id", "abc"),
        ];
        let without_track = vec![
            pair("txn_id", "9AB"),
            pair("verify_sign", "Sig"),
            pair("ipn_track_id", ""),
        ];
        let only_transaction = vec![pair("txn_id", "9AB")];

        assert_eq!(read_lookup_value(&with_all), Some("abc"));
        assert_eq!(read_lookup_value(&without_track), Some("Sig"));
        assert_eq!(read_lookup_value(&only_transaction), Some("9AB"));
        assert_eq!(read_lookup_value(&vec![pair("custom", "x")]), None);
    }

    #[test]
    fn the_postback_path_is_matched_with_or_without_a_trailing_slash() {
        assert!(is_ipn_postback_path("/cgi-bin/webscr"));
        assert!(is_ipn_postback_path("/cgi-bin/webscr/"));
        assert!(!is_ipn_postback_path("/cgi-bin/webscr/extra"));
    }
}
