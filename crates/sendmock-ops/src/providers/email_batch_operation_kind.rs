use serde_json::Value;

use super::created_message::CreatedMessage;
use super::email_send_operation_kind::send_one_email;
use super::provider_call::ProviderCall;
use super::provider_http::ProviderHttpResponse;
use super::request_checks::ProviderFailure;
use super::send_operation_kind::ProviderAnswer;
use crate::{OperationContext, OperationError};

/// Providers whose batch answer wraps the items in a field: Resend answers
/// `{"data": [...]}`; the others, such as Postmark, answer the bare list.
const BATCH_RESPONSE_FIELDS: [(&str, &str); 1] = [("resend", "data")];

/// Sends each message of a batch on its own, as Postmark and Resend do, and answers one item
/// per message: the success template's body, or the failure's for a message refused.
pub async fn answer_email_batch(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    let Some(batch_messages) = provider_call.request_fields.as_array() else {
        let failure = ProviderFailure::new(
            "invalid_value",
            "body",
            "A batch is a list of messages".to_owned(),
        );
        return Ok(ProviderAnswer::without_message(
            provider_call.render_failure(&failure),
        ));
    };
    let mut answered_items = Vec::new();
    let mut first_email_id = None;
    let mut success_response = None;
    for batch_message in batch_messages {
        match send_one_email(operation_context, provider_call, batch_message).await? {
            Ok(sent_email) => {
                let item_response = provider_call.render_success(&sent_email.described_email);
                answered_items.push(read_item_body(&item_response));
                first_email_id.get_or_insert(sent_email.email_id);
                success_response.get_or_insert(item_response);
            }
            Err(failure) => {
                answered_items.push(read_item_body(&provider_call.render_failure(&failure)));
            }
        }
    }
    let batch_body = wrap_batch_items(&provider_call.provider.key, answered_items);
    let mut response = success_response
        .unwrap_or_else(|| provider_call.render_success(&Value::Object(Default::default())));
    response.body = batch_body.to_string();
    Ok(ProviderAnswer {
        response,
        created_message: first_email_id.map(CreatedMessage::email),
    })
}

fn read_item_body(item_response: &ProviderHttpResponse) -> Value {
    serde_json::from_str(&item_response.body)
        .unwrap_or_else(|_| Value::from(item_response.body.clone()))
}

fn wrap_batch_items(provider_key: &str, answered_items: Vec<Value>) -> Value {
    let items = Value::Array(answered_items);
    match BATCH_RESPONSE_FIELDS
        .iter()
        .find(|(batch_provider_key, _)| *batch_provider_key == provider_key)
    {
        Some((_, response_field)) => {
            let mut wrapped_items = serde_json::Map::new();
            wrapped_items.insert((*response_field).to_owned(), items);
            Value::Object(wrapped_items)
        }
        None => items,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn resend_wraps_its_batch_items_in_data_and_postmark_answers_the_list() {
        let items = vec![json!({"id": "a"}), json!({"id": "b"})];

        assert_eq!(
            wrap_batch_items("resend", items.clone()),
            json!({"data": [{"id": "a"}, {"id": "b"}]})
        );
        assert_eq!(
            wrap_batch_items("postmark", items),
            json!([{"id": "a"}, {"id": "b"}])
        );
    }
}
