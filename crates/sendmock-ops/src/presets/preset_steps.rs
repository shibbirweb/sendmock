//! The steps a preset runs beside its setup file: the signing key, the Debugger URL and the
//! numbers, each changing nothing when it is already done.

use serde_json::json;

use crate::message_providers::{ProviderUpdate, update_area_provider};
use crate::numbers::{VirtualNumberInput, build_virtual_number, field_error};
use crate::providers::{SMS_PROVIDER_AREA, find_area_provider};
use crate::twilio_accounts::TWILIO_PROVIDER_KEY;
use crate::webhooks::{CreateWebhookVariableOperation, WebhookVariableInput};
use crate::{Operation, OperationContext, OperationError};

const SIGNING_KEY_VARIABLE: &str = "mailgun_signing_key";

/// The Mailgun signing key webhooks are signed with: the stored one, or a new one; answers the
/// key and whether it was made now.
pub async fn ensure_mailgun_signing_key(
    operation_context: &OperationContext,
) -> Result<(String, bool), OperationError> {
    let stored_variables = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?;
    if let Some(stored_key) = stored_variables
        .iter()
        .find(|variable| variable.name == SIGNING_KEY_VARIABLE && variable.endpoint_id.is_none())
    {
        return Ok((stored_key.value.clone(), false));
    }
    let random_source = &operation_context.random_source;
    let signing_key = format!(
        "key-{:016x}{:016x}",
        random_source.next_u64(),
        random_source.next_u64()
    );
    let variable_input: WebhookVariableInput = serde_json::from_value(json!({
        "name": SIGNING_KEY_VARIABLE, "kind": "secret", "scope": "global", "endpoint_id": null,
        "value": signing_key, "description": "Signs Mailgun webhooks, as your app's MAILGUN_WEBHOOK_SIGNING_KEY",
    }))
    .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
    CreateWebhookVariableOperation
        .execute(operation_context, variable_input)
        .await?;
    Ok((signing_key, true))
}

/// Points the Twilio provider's `debugger_url` at the app; answers what it did.
pub async fn set_twilio_debugger_url(
    operation_context: &OperationContext,
    debugger_url: &str,
) -> Result<String, OperationError> {
    let twilio_provider =
        find_area_provider(operation_context, SMS_PROVIDER_AREA, TWILIO_PROVIDER_KEY).await?;
    if twilio_provider.find_credential("debugger_url") == Some(debugger_url) {
        return Ok(format!(
            "The Twilio Debugger URL is already {debugger_url}."
        ));
    }
    let mut credentials = twilio_provider.credentials.clone();
    match credentials
        .iter_mut()
        .find(|credential| credential.name == "debugger_url")
    {
        Some(credential) => debugger_url.clone_into(&mut credential.value),
        None => credentials.push(
            serde_json::from_value(json!({
                "name": "debugger_url", "value": debugger_url, "is_secret": false,
            }))
            .map_err(|read_error| OperationError::Internal(read_error.to_string()))?,
        ),
    }
    let provider_update: ProviderUpdate = serde_json::from_value(json!({
        "provider_key": TWILIO_PROVIDER_KEY, "credentials": credentials,
    }))
    .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
    update_area_provider(operation_context, SMS_PROVIDER_AREA, provider_update).await?;
    Ok(format!("Set the Twilio Debugger URL to {debugger_url}."))
}

/// Adds or updates each number of `number,label,subaccount_sid,messaging_service_sid` lines.
pub async fn import_numbers_csv(
    operation_context: &OperationContext,
    numbers_csv: &str,
) -> Result<usize, OperationError> {
    let mut imported_count = 0;
    for csv_line in numbers_csv
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        if csv_line.to_ascii_lowercase().starts_with("number") {
            continue;
        }
        let mut cells = csv_line.split(',').map(str::trim);
        let number = cells.next().unwrap_or_default().to_owned();
        let label = cells
            .next()
            .filter(|cell| !cell.is_empty())
            .unwrap_or(&number)
            .to_owned();
        let account_sid = cells.next().filter(|cell| !cell.is_empty());
        let messaging_service_sid = cells.next().filter(|cell| !cell.is_empty());
        let number_input: VirtualNumberInput = serde_json::from_value(json!({
            "number": number, "label": label, "channels": ["sms"], "inbound_url": null,
            "inbound_fallback_url": null, "inbound_template_id": "twilio.inbound_sms",
            "status_callback_url": null, "messaging_service_sid": messaging_service_sid,
            "account_sid": account_sid,
        }))
        .map_err(|_| field_error("numbers_csv", &format!("Cannot read the line {csv_line}")))?;
        let number_repository = &operation_context.virtual_number_repository;
        let existing_number = number_repository.find_by_number(&number).await?;
        let is_new_number = existing_number.is_none();
        let built_number =
            build_virtual_number(operation_context, number_input, existing_number).await?;
        if is_new_number {
            number_repository.insert_number(built_number).await?;
        } else {
            number_repository.update_number(built_number).await?;
        }
        imported_count += 1;
    }
    Ok(imported_count)
}
