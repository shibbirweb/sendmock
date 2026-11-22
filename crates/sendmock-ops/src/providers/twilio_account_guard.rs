use base64::Engine;
use base64::engine::general_purpose::STANDARD;

use super::provider_call::ProviderCall;
use super::request_checks::has_valid_credentials;
use super::send_operation_kind::ProviderAnswer;
use super::twilio_answers::answer_twilio_error;
use crate::twilio_accounts::{TwilioAccountDirectory, TwilioAccountStatus};
use crate::{OperationContext, OperationError};

const TWILIO_PROVIDER_KEY: &str = "twilio";
const ACCOUNT_SID_PATH_PARAM: &str = "AccountSid";

/// What a Twilio request under `/Accounts/{AccountSid}/...` is allowed to do.
pub enum TwilioAccountCheck {
    /// Not a Twilio request, or one the account may make.
    Allowed,
    /// The credentials match no account.
    Unauthorized,
    /// Twilio's answer for a suspended or closed subaccount; nothing is stored.
    Refused(ProviderAnswer),
}

/// The provider's own credential check, which for Twilio also accepts a subaccount's SID and
/// token, and refuses a send under a suspended or closed subaccount as Twilio does.
pub async fn check_twilio_account(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<TwilioAccountCheck, OperationError> {
    let provider = provider_call.provider;
    let has_provider_credentials = has_valid_credentials(provider, provider_call.request);
    if provider.key != TWILIO_PROVIDER_KEY {
        return Ok(if has_provider_credentials {
            TwilioAccountCheck::Allowed
        } else {
            TwilioAccountCheck::Unauthorized
        });
    }
    let directory = TwilioAccountDirectory::load(operation_context).await?;
    let path_account = provider_call
        .path_params
        .get(ACCOUNT_SID_PATH_PARAM)
        .and_then(|account_sid| {
            directory
                .subaccounts
                .iter()
                .find(|subaccount| &subaccount.account_sid == account_sid)
        });
    let has_subaccount_credentials = path_account.is_some_and(|subaccount| {
        !subaccount.auth_token.is_empty()
            && read_basic_password(provider_call).as_deref() == Some(subaccount.auth_token.as_str())
    });
    if !has_provider_credentials && !has_subaccount_credentials {
        return Ok(TwilioAccountCheck::Unauthorized);
    }
    let is_inactive =
        path_account.is_some_and(|subaccount| subaccount.status != TwilioAccountStatus::Active);
    if is_inactive && provider_call.operation.kind == "send" {
        return Ok(TwilioAccountCheck::Refused(
            ProviderAnswer::without_message(answer_twilio_error(403, 20005, "Account not active")),
        ));
    }
    Ok(TwilioAccountCheck::Allowed)
}

/// The password of the request's Basic auth, which Twilio's SDKs send as SID and token.
fn read_basic_password(provider_call: &ProviderCall<'_>) -> Option<String> {
    provider_call
        .request
        .header("authorization")
        .and_then(|authorization| authorization.strip_prefix("Basic "))
        .and_then(|encoded| STANDARD.decode(encoded.trim()).ok())
        .and_then(|decoded| String::from_utf8(decoded).ok())
        .and_then(|credentials| {
            credentials
                .split_once(':')
                .map(|(_, password)| password.to_owned())
        })
}
