use sendmock_store::VirtualNumberRecord;
use serde_json::{Value, json};

use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::request_reader::read_request_fields;
use super::twilio_answers::{answer_json, answer_no_content, answer_twilio_error, read_form_field};
use super::twilio_incoming_number_shape::{
    ACCOUNTS_PREFIX, NUMBERS_SEGMENT, apply_fields, describe_number, owner_of,
};
use crate::numbers::{generate_phone_number_sid, is_e164};
use crate::twilio_accounts::TwilioAccountDirectory;
use crate::{OperationContext, OperationError};

/// The account and the number a request names.
struct NumbersTarget<'path> {
    account_sid: &'path str,
    phone_number_sid: Option<&'path str>,
}

/// `/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json` and `.../{PNSid}.json`.
fn read_numbers_target(request_path: &str) -> Option<NumbersTarget<'_>> {
    let after_accounts = request_path.strip_prefix(ACCOUNTS_PREFIX)?;
    let (account_sid, rest_of_path) = after_accounts.split_once('/')?;
    if rest_of_path == "IncomingPhoneNumbers.json" {
        return Some(NumbersTarget {
            account_sid,
            phone_number_sid: None,
        });
    }
    let phone_number_sid = rest_of_path
        .strip_prefix("IncomingPhoneNumbers/")?
        .strip_suffix(".json")?;
    (!phone_number_sid.is_empty() && !phone_number_sid.contains('/')).then_some(NumbersTarget {
        account_sid,
        phone_number_sid: Some(phone_number_sid),
    })
}

/// Twilio's IncomingPhoneNumbers API over SendMock's virtual numbers: list (by `PhoneNumber`
/// and `FriendlyName`), create (from `PhoneNumber` or `AreaCode`), fetch, update and delete.
/// A number belongs to the account it was created under; numbers made in the UI belong to
/// the main account. `None` for other paths.
pub async fn answer_incoming_numbers_request(
    operation_context: &OperationContext,
    directory: &TwilioAccountDirectory,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let Some(target) = read_numbers_target(&request.path) else {
        return Ok(None);
    };
    let main_account_sid = directory.main_account.account_sid.as_str();
    let fields = read_request_fields(request, "form").unwrap_or_default();
    let repository = &operation_context.virtual_number_repository;
    let owned_number = match target.phone_number_sid {
        Some(phone_number_sid) => repository
            .find_by_phone_number_sid(phone_number_sid)
            .await?
            .filter(|stored_number| {
                owner_of(stored_number, main_account_sid) == target.account_sid
            }),
        None => None,
    };
    let response = match (request.method.as_str(), target.phone_number_sid) {
        ("GET", None) => {
            let stored_numbers = repository.list_numbers().await?;
            answer_number_page(&stored_numbers, &target, main_account_sid, &fields)
        }
        ("POST", None) => {
            create_number(operation_context, &target, main_account_sid, &fields).await?
        }
        ("GET", Some(_)) => match owned_number {
            Some(stored_number) => {
                answer_json(200, describe_number(&stored_number, main_account_sid))
            }
            None => answer_number_not_found(&request.path),
        },
        ("POST", Some(_)) => match owned_number {
            Some(stored_number) => {
                let changed_number = apply_fields(stored_number, &fields);
                repository.update_number(changed_number.clone()).await?;
                answer_json(200, describe_number(&changed_number, main_account_sid))
            }
            None => answer_number_not_found(&request.path),
        },
        ("DELETE", Some(_)) => match owned_number {
            Some(stored_number) => {
                repository.delete_number(&stored_number.number_id).await?;
                answer_no_content()
            }
            None => answer_number_not_found(&request.path),
        },
        _ => return Ok(None),
    };
    Ok(Some(response))
}

fn answer_number_page(
    stored_numbers: &[VirtualNumberRecord],
    target: &NumbersTarget<'_>,
    main_account_sid: &str,
    fields: &Value,
) -> ProviderHttpResponse {
    let phone_number_filter = read_form_field(fields, "PhoneNumber");
    let friendly_name_filter = read_form_field(fields, "FriendlyName");
    let listed_numbers: Vec<Value> = stored_numbers
        .iter()
        .filter(|stored_number| owner_of(stored_number, main_account_sid) == target.account_sid)
        .filter(|stored_number| {
            phone_number_filter
                .as_deref()
                .is_none_or(|phone_number| stored_number.number.contains(phone_number))
        })
        .filter(|stored_number| {
            friendly_name_filter
                .as_deref()
                .is_none_or(|friendly_name| stored_number.label == friendly_name)
        })
        .map(|stored_number| describe_number(stored_number, main_account_sid))
        .collect();
    let page_uri = format!(
        "{ACCOUNTS_PREFIX}{}{NUMBERS_SEGMENT}.json?PageSize=50&Page=0",
        target.account_sid
    );
    answer_json(
        200,
        json!({
            "incoming_phone_numbers": listed_numbers,
            "end": listed_numbers.len().saturating_sub(1),
            "first_page_uri": page_uri,
            "next_page_uri": Value::Null,
            "page": 0,
            "page_size": 50,
            "previous_page_uri": Value::Null,
            "start": 0,
            "uri": page_uri,
        }),
    )
}

async fn create_number(
    operation_context: &OperationContext,
    target: &NumbersTarget<'_>,
    main_account_sid: &str,
    fields: &Value,
) -> Result<ProviderHttpResponse, OperationError> {
    let e164_number = match resolve_requested_number(operation_context, fields).await? {
        Ok(e164_number) => e164_number,
        Err(refusal) => return Ok(refusal),
    };
    let account_sid =
        (target.account_sid != main_account_sid).then(|| target.account_sid.to_owned());
    let new_number = apply_fields(
        build_api_number(operation_context, e164_number, account_sid),
        fields,
    );
    operation_context
        .virtual_number_repository
        .insert_number(new_number.clone())
        .await?;
    Ok(answer_json(
        201,
        describe_number(&new_number, main_account_sid),
    ))
}

/// The E.164 number a create asks for, from `PhoneNumber` or a free one in `AreaCode`, or
/// Twilio's error when it is missing, invalid or taken.
async fn resolve_requested_number(
    operation_context: &OperationContext,
    fields: &Value,
) -> Result<Result<String, ProviderHttpResponse>, OperationError> {
    let e164_number = match (
        read_form_field(fields, "PhoneNumber"),
        read_form_field(fields, "AreaCode"),
    ) {
        (Some(phone_number), _) => phone_number,
        (None, Some(area_code)) => {
            match find_free_number_in_area(operation_context, &area_code).await? {
                Some(free_number) => free_number,
                None => {
                    return Ok(Err(answer_twilio_error(
                        400,
                        21452,
                        &format!("No phone numbers found in area code {area_code}"),
                    )));
                }
            }
        }
        (None, None) => {
            return Ok(Err(answer_twilio_error(
                400,
                21421,
                "PhoneNumber or AreaCode is required",
            )));
        }
    };
    if !is_e164(&e164_number) {
        return Ok(Err(answer_twilio_error(
            400,
            21421,
            "PhoneNumber is invalid",
        )));
    }
    let registered_number = operation_context
        .virtual_number_repository
        .find_by_number(&e164_number)
        .await?;
    if registered_number.is_some() {
        return Ok(Err(answer_twilio_error(
            400,
            21422,
            "PhoneNumber is not available",
        )));
    }
    Ok(Ok(e164_number))
}

/// A number created through the API: SMS only, named by itself until `FriendlyName` says
/// otherwise, under the account in the path.
fn build_api_number(
    operation_context: &OperationContext,
    e164_number: String,
    account_sid: Option<String>,
) -> VirtualNumberRecord {
    VirtualNumberRecord {
        number_id: operation_context.id_generator.generate_id().to_string(),
        label: e164_number.clone(),
        number: e164_number,
        channels: vec!["sms".to_owned()],
        inbound_url: None,
        inbound_method: "POST".to_owned(),
        inbound_fallback_url: None,
        inbound_template_id: None,
        status_callback_url: None,
        messaging_service_sid: None,
        phone_number_sid: generate_phone_number_sid(operation_context),
        account_sid,
        opt_out_keywords: true,
        created_by: "api".to_owned(),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    }
}

/// A number in the area code that is not registered yet: `+1`, the area code, `555` and four
/// digits, the range kept for fictional numbers.
async fn find_free_number_in_area(
    operation_context: &OperationContext,
    area_code: &str,
) -> Result<Option<String>, OperationError> {
    let is_area_code =
        area_code.len() == 3 && area_code.chars().all(|digit| digit.is_ascii_digit());
    if !is_area_code {
        return Ok(None);
    }
    let repository = &operation_context.virtual_number_repository;
    for line_number in 100..10_000 {
        let candidate_number = format!("+1{area_code}555{line_number:04}");
        if repository
            .find_by_number(&candidate_number)
            .await?
            .is_none()
        {
            return Ok(Some(candidate_number));
        }
    }
    Ok(None)
}

fn answer_number_not_found(request_path: &str) -> ProviderHttpResponse {
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
    fn reads_the_list_and_one_number_paths_only() {
        let list_target =
            read_numbers_target("/2010-04-01/Accounts/ACmain/IncomingPhoneNumbers.json");
        let one_target =
            read_numbers_target("/2010-04-01/Accounts/ACmain/IncomingPhoneNumbers/PN1.json");

        assert!(list_target.is_some_and(
            |target| target.account_sid == "ACmain" && target.phone_number_sid.is_none()
        ));
        assert!(one_target.is_some_and(|target| target.phone_number_sid == Some("PN1")));
        assert!(read_numbers_target("/2010-04-01/Accounts/ACmain/Messages.json").is_none());
        assert!(read_numbers_target("/2010-04-01/Accounts/ACmain.json").is_none());
    }
}
