use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::twilio_accounts_api::answer_twilio_accounts_request;
use super::twilio_incoming_numbers_api::answer_incoming_numbers_request;
use super::twilio_messaging_services::answer_messaging_services_request;
use super::twilio_service_numbers_api::answer_service_numbers_request;
use crate::twilio_accounts::TwilioAccountDirectory;
use crate::{OperationContext, OperationError};

/// A Twilio API answer and the secrets to mask in the request log.
pub struct TwilioApiAnswer {
    pub response: ProviderHttpResponse,
    pub secret_values: Vec<String>,
    /// Why the API answered as it did, for the request log.
    pub note: Option<String>,
}

/// Twilio's APIs served in code beside the Messages definition: Accounts, IncomingPhoneNumbers,
/// Messaging Services and their PhoneNumbers. `None` when the path is none of them.
pub async fn answer_twilio_api_request(
    operation_context: &OperationContext,
    twilio_provider: &MessageProviderDefinition,
    provider_secret_values: Vec<String>,
    request: &ProviderHttpRequest,
) -> Result<Option<TwilioApiAnswer>, OperationError> {
    if let Some(accounts_answer) =
        answer_twilio_accounts_request(operation_context, twilio_provider, request).await?
    {
        return Ok(Some(TwilioApiAnswer {
            response: accounts_answer.response,
            secret_values: accounts_answer.secret_values,
            note: accounts_answer.note,
        }));
    }
    let stored_subaccounts = operation_context
        .twilio_subaccount_repository
        .list_subaccounts()
        .await?;
    let directory = TwilioAccountDirectory::from_parts(Some(twilio_provider), stored_subaccounts);
    let with_provider_secrets = |response| {
        Some(TwilioApiAnswer {
            response,
            secret_values: provider_secret_values.clone(),
            note: None,
        })
    };
    if let Some(numbers_response) =
        answer_incoming_numbers_request(operation_context, &directory, request).await?
    {
        return Ok(with_provider_secrets(numbers_response));
    }
    if let Some(pool_response) =
        answer_service_numbers_request(operation_context, &directory, request).await?
    {
        return Ok(with_provider_secrets(pool_response));
    }
    let services_response =
        answer_messaging_services_request(operation_context, twilio_provider, request).await?;
    Ok(services_response.and_then(with_provider_secrets))
}
