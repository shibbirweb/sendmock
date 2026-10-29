use sendmock_store::SmsListFilter;
use serde_json::{Value, json};

use super::provider_call::{ProviderCall, describe_message};
use super::request_checks::ProviderFailure;
use super::send_operation_kind::ProviderAnswer;
use crate::{OperationContext, OperationError};

const DEFAULT_PAGE_SIZE: u32 = 50;
/// The success template answers a send; reading creates nothing, so `201` becomes `200`.
const CREATED_STATUS: u16 = 201;
const OK_STATUS: u16 = 200;
const MAXIMUM_PAGE_SIZE: u32 = 1000;

/// One message by the provider's id, the last `{name}` part of the path; the provider's
/// `not_found` answer when it is not one of this provider's messages.
pub async fn answer_fetch(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    let provider_message_id = read_last_path_param(provider_call).unwrap_or_default();
    let filter = SmsListFilter {
        api: Some(provider_call.provider.key.clone()),
        provider_id: Some(provider_message_id.clone()),
        ..SmsListFilter::default()
    };
    let page = operation_context
        .sms_repository
        .list_messages(filter, None, 1)
        .await?;
    let response = match page.messages.first() {
        Some(sms) => {
            let mut response =
                provider_call.render_success(&describe_message(provider_call.provider, sms));
            if response.status == CREATED_STATUS {
                response.status = OK_STATUS;
            }
            response
        }
        None => provider_call.render_failure(&ProviderFailure::new(
            "not_found",
            "path",
            format!("No message {provider_message_id}"),
        )),
    };
    Ok(ProviderAnswer::without_message(response))
}

/// The provider's messages, newest first, filtered by the mapped `to` and `from` and paged
/// with `PageSize`, in Twilio's page shape: the list under the collection's name (`messages`
/// for `.../Messages.json`) with the paging fields.
pub async fn answer_list(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    let part_values = provider_call.read_part_values();
    let first_value = |part: &str| {
        part_values
            .get(part)
            .and_then(|values| values.first())
            .cloned()
    };
    let page_size = provider_call
        .request_fields
        .get("PageSize")
        .and_then(|page_size| page_size.as_str()?.parse::<u32>().ok())
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .clamp(1, MAXIMUM_PAGE_SIZE);
    let filter = SmsListFilter {
        api: Some(provider_call.provider.key.clone()),
        to_number: first_value("to"),
        from_number: first_value("from"),
        ..SmsListFilter::default()
    };
    let page = operation_context
        .sms_repository
        .list_messages(filter, None, page_size)
        .await?;
    let listed_messages: Vec<Value> = page
        .messages
        .iter()
        .map(|sms| {
            let rendered =
                provider_call.render_success(&describe_message(provider_call.provider, sms));
            serde_json::from_str(&rendered.body).unwrap_or(Value::String(rendered.body))
        })
        .collect();
    let mut response = provider_call.render_success(&json!({}));
    response.status = OK_STATUS;
    response.body =
        build_page_body(&provider_call.request.path, listed_messages, page_size).to_string();
    Ok(ProviderAnswer::without_message(response))
}

fn build_page_body(path: &str, listed_messages: Vec<Value>, page_size: u32) -> Value {
    let listed_count = listed_messages.len();
    json!({
        name_collection(path): listed_messages,
        "page": 0,
        "page_size": page_size,
        "start": 0,
        "end": listed_count.saturating_sub(1),
        "uri": path,
        "first_page_uri": format!("{path}?PageSize={page_size}&Page=0"),
        "next_page_uri": Value::Null,
        "previous_page_uri": Value::Null,
    })
}

fn read_last_path_param(provider_call: &ProviderCall<'_>) -> Option<String> {
    let last_param_name = provider_call
        .operation
        .path
        .rsplit('{')
        .next()?
        .split('}')
        .next()?;
    provider_call.path_params.get(last_param_name).cloned()
}

/// `messages` for `/2010-04-01/Accounts/AC1/Messages.json`.
fn name_collection(path: &str) -> String {
    let last_segment = path.rsplit('/').next().unwrap_or(path);
    let collection_name = last_segment.split('.').next().unwrap_or(last_segment);
    if collection_name.is_empty() {
        "items".to_owned()
    } else {
        collection_name.to_lowercase()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_collection_is_named_after_the_path() {
        assert_eq!(
            name_collection("/2010-04-01/Accounts/AC1/Messages.json"),
            "messages"
        );
        assert_eq!(name_collection("/v1/Message/"), "items");
    }
}
