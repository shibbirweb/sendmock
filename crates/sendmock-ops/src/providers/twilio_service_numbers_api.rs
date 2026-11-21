use sendmock_core::format_rfc3339;
use sendmock_store::{MessagingServiceRecord, VirtualNumberRecord};
use serde_json::{Value, json};

use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::request_reader::read_request_fields;
use super::twilio_answers::{
    answer_json, answer_no_content, answer_twilio_error, describe_page_meta, read_form_field,
};
use crate::twilio_accounts::TwilioAccountDirectory;
use crate::{OperationContext, OperationError};

const SERVICES_PREFIX: &str = "/v1/Services/";
const SERVICES_URL: &str = "https://messaging.twilio.com/v1/Services";
/// Country calling codes to ISO country codes, longest first, for the numbers SendMock's
/// examples and test numbers use.
const COUNTRY_CALLING_CODES: [(&str, &str); 12] = [
    ("+880", "BD"),
    ("+234", "NG"),
    ("+254", "KE"),
    ("+971", "AE"),
    ("+44", "GB"),
    ("+49", "DE"),
    ("+33", "FR"),
    ("+34", "ES"),
    ("+61", "AU"),
    ("+91", "IN"),
    ("+55", "BR"),
    ("+1", "US"),
];

struct ServiceNumbersTarget<'path> {
    service_sid: &'path str,
    phone_number_sid: Option<&'path str>,
}

/// `/v1/Services/{ServiceSid}/PhoneNumbers` and `.../PhoneNumbers/{PhoneNumberSid}`.
fn read_service_numbers_target(request_path: &str) -> Option<ServiceNumbersTarget<'_>> {
    let (service_sid, rest_of_path) = request_path
        .strip_prefix(SERVICES_PREFIX)?
        .split_once('/')?;
    if rest_of_path == "PhoneNumbers" {
        return Some(ServiceNumbersTarget {
            service_sid,
            phone_number_sid: None,
        });
    }
    let phone_number_sid = rest_of_path.strip_prefix("PhoneNumbers/")?;
    (!phone_number_sid.is_empty() && !phone_number_sid.contains('/')).then_some(
        ServiceNumbersTarget {
            service_sid,
            phone_number_sid: Some(phone_number_sid),
        },
    )
}

/// Twilio's PhoneNumber subresource of a Messaging Service, over the sender pool the Numbers
/// screen edits: list, fetch, add (`PhoneNumberSid`) and remove. `None` for other paths.
pub async fn answer_service_numbers_request(
    operation_context: &OperationContext,
    directory: &TwilioAccountDirectory,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let Some(target) = read_service_numbers_target(&request.path) else {
        return Ok(None);
    };
    let Some(service) = operation_context
        .messaging_service_repository
        .find_service(target.service_sid)
        .await?
    else {
        return Ok(Some(answer_not_found(&request.path)));
    };
    let main_account_sid = directory.main_account.account_sid.as_str();
    let pool_numbers = list_pool_numbers(operation_context, &service).await?;
    let response = match (request.method.as_str(), target.phone_number_sid) {
        ("GET", None) => answer_pool_page(&pool_numbers, &service, main_account_sid),
        ("POST", None) => {
            let fields = read_request_fields(request, "form").unwrap_or_default();
            add_number(operation_context, service, &fields, main_account_sid).await?
        }
        ("GET", Some(phone_number_sid)) => {
            match find_pool_number(&pool_numbers, phone_number_sid) {
                Some(pool_number) => answer_json(
                    200,
                    describe_service_number(pool_number, &service, main_account_sid),
                ),
                None => answer_not_found(&request.path),
            }
        }
        ("DELETE", Some(phone_number_sid)) => {
            match find_pool_number(&pool_numbers, phone_number_sid) {
                Some(pool_number) => {
                    remove_number(operation_context, service, &pool_number.number_id).await?
                }
                None => answer_not_found(&request.path),
            }
        }
        _ => return Ok(None),
    };
    Ok(Some(response))
}

fn answer_pool_page(
    pool_numbers: &[VirtualNumberRecord],
    service: &MessagingServiceRecord,
    main_account_sid: &str,
) -> ProviderHttpResponse {
    let list_url = format!("{SERVICES_URL}/{}/PhoneNumbers", service.service_sid);
    let described_numbers: Vec<Value> = pool_numbers
        .iter()
        .map(|pool_number| describe_service_number(pool_number, service, main_account_sid))
        .collect();
    answer_json(
        200,
        json!({
            "phone_numbers": described_numbers,
            "meta": describe_page_meta(&list_url, "phone_numbers"),
        }),
    )
}

/// Takes the number out of the pool; it stays registered.
async fn remove_number(
    operation_context: &OperationContext,
    mut service: MessagingServiceRecord,
    removed_number_id: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    service
        .number_ids
        .retain(|number_id| number_id != removed_number_id);
    operation_context
        .messaging_service_repository
        .save_service(service)
        .await?;
    Ok(answer_no_content())
}

async fn list_pool_numbers(
    operation_context: &OperationContext,
    service: &MessagingServiceRecord,
) -> Result<Vec<VirtualNumberRecord>, OperationError> {
    let stored_numbers = operation_context
        .virtual_number_repository
        .list_numbers()
        .await?;
    Ok(stored_numbers
        .into_iter()
        .filter(|stored_number| service.number_ids.contains(&stored_number.number_id))
        .collect())
}

fn find_pool_number<'pool>(
    pool_numbers: &'pool [VirtualNumberRecord],
    phone_number_sid: &str,
) -> Option<&'pool VirtualNumberRecord> {
    pool_numbers
        .iter()
        .find(|pool_number| pool_number.phone_number_sid == phone_number_sid)
}

/// Adds the number named by `PhoneNumberSid`. A number in another service is refused, as
/// Twilio does; the Numbers screen's move is the way to change it.
async fn add_number(
    operation_context: &OperationContext,
    mut service: MessagingServiceRecord,
    fields: &Value,
    main_account_sid: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let Some(phone_number_sid) = read_form_field(fields, "PhoneNumberSid") else {
        return Ok(answer_twilio_error(
            400,
            20001,
            "Missing required parameter PhoneNumberSid in the post body",
        ));
    };
    let Some(stored_number) = operation_context
        .virtual_number_repository
        .find_by_phone_number_sid(&phone_number_sid)
        .await?
    else {
        return Ok(answer_twilio_error(
            404,
            20404,
            &format!("No phone number with SID {phone_number_sid}"),
        ));
    };
    match stored_number.messaging_service_sid.as_deref() {
        Some(pool_service_sid) if pool_service_sid == service.service_sid => {
            return Ok(answer_twilio_error(
                409,
                21710,
                "Phone Number is already in the Messaging Service",
            ));
        }
        Some(_) => {
            return Ok(answer_twilio_error(
                409,
                21712,
                "Phone Number is already associated with another Messaging Service",
            ));
        }
        None => {}
    }
    service.number_ids.push(stored_number.number_id.clone());
    let stored_service = operation_context
        .messaging_service_repository
        .save_service(service)
        .await?;
    Ok(answer_json(
        201,
        describe_service_number(&stored_number, &stored_service, main_account_sid),
    ))
}

fn find_country_code(e164_number: &str) -> &'static str {
    COUNTRY_CALLING_CODES
        .iter()
        .find(|(calling_code, _)| e164_number.starts_with(calling_code))
        .map_or("US", |(_, country_code)| country_code)
}

/// Twilio's Messaging Service PhoneNumber resource.
fn describe_service_number(
    pool_number: &VirtualNumberRecord,
    service: &MessagingServiceRecord,
    main_account_sid: &str,
) -> Value {
    let created_at = format_rfc3339(pool_number.created_at_unix_ms);
    let has_sms = pool_number.channels.iter().any(|channel| channel == "sms");
    let capabilities: Vec<&str> = if has_sms {
        vec!["SMS", "MMS"]
    } else {
        Vec::new()
    };
    json!({
        "sid": pool_number.phone_number_sid,
        "account_sid": pool_number.account_sid.as_deref().unwrap_or(main_account_sid),
        "service_sid": service.service_sid,
        "date_created": created_at,
        "date_updated": created_at,
        "phone_number": pool_number.number,
        "country_code": find_country_code(&pool_number.number),
        "capabilities": capabilities,
        "url": format!(
            "{SERVICES_URL}/{}/PhoneNumbers/{}",
            service.service_sid, pool_number.phone_number_sid
        ),
    })
}

fn answer_not_found(request_path: &str) -> ProviderHttpResponse {
    answer_twilio_error(
        404,
        20404,
        &format!("The requested resource {request_path} was not found"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_pool_paths_and_names_the_country_of_a_number() {
        let list_target = read_service_numbers_target("/v1/Services/MG1/PhoneNumbers");
        let one_target = read_service_numbers_target("/v1/Services/MG1/PhoneNumbers/PN1");

        assert!(
            list_target.is_some_and(
                |target| target.service_sid == "MG1" && target.phone_number_sid.is_none()
            )
        );
        assert!(one_target.is_some_and(|target| target.phone_number_sid == Some("PN1")));
        assert!(read_service_numbers_target("/v1/Services/MG1").is_none());
        assert_eq!(find_country_code("+8801700000000"), "BD");
        assert_eq!(find_country_code("+14155550100"), "US");
        assert_eq!(find_country_code("+447700900000"), "GB");
    }
}
