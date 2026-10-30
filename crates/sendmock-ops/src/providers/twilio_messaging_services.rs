use sendmock_core::format_rfc3339;
use sendmock_store::MessagingServiceRecord;
use serde_json::{Value, json};

use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::request_reader::read_request_fields;
use super::twilio_answers::{
    answer_json, answer_no_content, answer_twilio_error, describe_page_meta, read_account_sid,
    read_form_field,
};
use crate::numbers::generate_service_sid;
use crate::{OperationContext, OperationError};

const SERVICES_PATH: &str = "/v1/Services";
const SERVICES_URL: &str = "https://messaging.twilio.com/v1/Services";

/// Twilio's Messaging Services API (`messaging.twilio.com/v1/Services`): create, list, fetch,
/// update and delete, over the same services as the Numbers screen. `None` for other paths.
pub async fn answer_messaging_services_request(
    operation_context: &OperationContext,
    twilio_provider: &MessageProviderDefinition,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let Some(rest_of_path) = request.path.strip_prefix(SERVICES_PATH) else {
        return Ok(None);
    };
    let service_sid = rest_of_path
        .strip_prefix('/')
        .filter(|sid| !sid.is_empty() && !sid.contains('/'));
    if !rest_of_path.is_empty() && service_sid.is_none() {
        return Ok(None);
    }
    let account_sid = read_account_sid(twilio_provider, request);
    let fields = read_request_fields(request, "form").unwrap_or_default();
    let repository = &operation_context.messaging_service_repository;
    let response = match (request.method.as_str(), service_sid) {
        ("POST", None) => create_service(operation_context, &fields, &account_sid).await?,
        ("GET", None) => {
            let services = repository.list_services().await?;
            answer_service_page(&services, &account_sid)
        }
        ("GET", Some(service_sid)) => match repository.find_service(service_sid).await? {
            Some(service) => answer_json(200, describe_service(&service, &account_sid)),
            None => answer_not_found(service_sid),
        },
        ("POST", Some(service_sid)) => match repository.find_service(service_sid).await? {
            Some(service) => {
                let changed_service = repository
                    .save_service(apply_fields(service, &fields))
                    .await?;
                answer_json(200, describe_service(&changed_service, &account_sid))
            }
            None => answer_not_found(service_sid),
        },
        ("DELETE", Some(service_sid)) => {
            if repository.delete_service(service_sid).await? {
                answer_no_content()
            } else {
                answer_not_found(service_sid)
            }
        }
        _ => return Ok(None),
    };
    Ok(Some(response))
}

async fn create_service(
    operation_context: &OperationContext,
    fields: &Value,
    account_sid: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    if read_form_field(fields, "FriendlyName").is_none() {
        return Ok(answer_twilio_error(
            400,
            20001,
            "Missing required parameter FriendlyName in the post body",
        ));
    }
    let new_service = apply_fields(
        MessagingServiceRecord {
            service_sid: generate_service_sid(operation_context),
            friendly_name: String::new(),
            number_ids: Vec::new(),
            inbound_mode: "defer_to_sender".to_owned(),
            inbound_url: None,
            inbound_fallback_url: None,
            created_by: "api".to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        },
        fields,
    );
    let stored_service = operation_context
        .messaging_service_repository
        .save_service(new_service)
        .await?;
    Ok(answer_json(
        201,
        describe_service(&stored_service, account_sid),
    ))
}

/// `FriendlyName`, `InboundRequestUrl`, `FallbackUrl` and `UseInboundWebhookOnNumber`.
fn apply_fields(mut service: MessagingServiceRecord, fields: &Value) -> MessagingServiceRecord {
    if let Some(friendly_name) = read_form_field(fields, "FriendlyName") {
        service.friendly_name = friendly_name;
    }
    if let Some(inbound_url) = read_form_field(fields, "InboundRequestUrl") {
        service.inbound_url = Some(inbound_url);
        service.inbound_mode = "webhook".to_owned();
    }
    if let Some(fallback_url) = read_form_field(fields, "FallbackUrl") {
        service.inbound_fallback_url = Some(fallback_url);
    }
    if read_form_field(fields, "UseInboundWebhookOnNumber")
        .is_some_and(|flag| flag.eq_ignore_ascii_case("true"))
    {
        service.inbound_mode = "defer_to_sender".to_owned();
    }
    service
}

/// A service as Twilio's Messaging Services API answers it.
fn describe_service(service: &MessagingServiceRecord, account_sid: &str) -> Value {
    let service_url = format!("{SERVICES_URL}/{}", service.service_sid);
    let created_at = format_rfc3339(service.created_at_unix_ms);
    json!({
        "account_sid": account_sid,
        "sid": service.service_sid,
        "friendly_name": service.friendly_name,
        "date_created": created_at,
        "date_updated": created_at,
        "inbound_request_url": service.inbound_url,
        "inbound_method": "POST",
        "fallback_url": service.inbound_fallback_url,
        "fallback_method": "POST",
        "status_callback": Value::Null,
        "sticky_sender": true,
        "mms_converter": true,
        "smart_encoding": true,
        "scan_message_content": "inherit",
        "fallback_to_long_code": true,
        "area_code_geomatch": true,
        "synchronous_validation": false,
        "validity_period": 14400,
        "use_inbound_webhook_on_number": service.inbound_mode == "defer_to_sender",
        "usecase": "undeclared",
        "us_app_to_person_registered": false,
        "url": service_url,
        "links": {
            "phone_numbers": format!("{service_url}/PhoneNumbers"),
            "short_codes": format!("{service_url}/ShortCodes"),
            "alpha_senders": format!("{service_url}/AlphaSenders"),
        },
    })
}

fn answer_service_page(
    services: &[MessagingServiceRecord],
    account_sid: &str,
) -> ProviderHttpResponse {
    let described_services: Vec<Value> = services
        .iter()
        .map(|service| describe_service(service, account_sid))
        .collect();
    answer_json(
        200,
        json!({
            "services": described_services,
            "meta": describe_page_meta(SERVICES_URL, "services"),
        }),
    )
}

fn answer_not_found(service_sid: &str) -> ProviderHttpResponse {
    answer_twilio_error(
        404,
        20404,
        &format!("The requested resource /Services/{service_sid} was not found"),
    )
}
