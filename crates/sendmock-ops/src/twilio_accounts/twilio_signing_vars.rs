use sendmock_store::{SmsListFilter, SmsRecord};
use serde_json::{Map, Value};

use super::twilio_account_directory::{TWILIO_PROVIDER_KEY, TwilioAccountDirectory};
use crate::providers::MessageProviderDefinition;
use crate::{OperationContext, OperationError};

/// Points `vars.twilio_account_sid` and `vars.twilio_auth_token` at the account a Twilio
/// webhook belongs to, so it is signed with that account's token. A SID that is not a
/// subaccount keeps the main account's token, as setups made before subaccounts expect.
pub async fn apply_twilio_account_vars(
    operation_context: &OperationContext,
    providers: &[MessageProviderDefinition],
    account_sid: Option<&str>,
    template_vars: &mut Map<String, Value>,
) -> Result<(), OperationError> {
    let Some(twilio_provider) = providers
        .iter()
        .find(|provider| provider.key == TWILIO_PROVIDER_KEY)
    else {
        return Ok(());
    };
    let stored_subaccounts = operation_context
        .twilio_subaccount_repository
        .list_subaccounts()
        .await?;
    let directory = TwilioAccountDirectory::from_parts(Some(twilio_provider), stored_subaccounts);
    let signing_account = directory.account_for(account_sid);
    if let Some(account_sid) = account_sid {
        template_vars.insert(
            format!("{TWILIO_PROVIDER_KEY}_account_sid"),
            Value::from(account_sid),
        );
    }
    template_vars.insert(
        format!("{TWILIO_PROVIDER_KEY}_auth_token"),
        Value::from(signing_account.auth_token.clone()),
    );
    Ok(())
}

/// The account an inbound message belongs to: its own, or that of the newest Twilio message
/// your app sent in the same conversation, since Twilio signs a reply with the account that
/// owns the number.
pub async fn find_conversation_account(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
) -> Result<Option<String>, OperationError> {
    if inbound_sms.account.is_some() {
        return Ok(inbound_sms.account.clone());
    }
    let filter = SmsListFilter {
        from_number: Some(inbound_sms.to_number.clone()),
        to_number: Some(inbound_sms.from_number.clone()),
        direction: Some("outbound".to_owned()),
        api: Some(TWILIO_PROVIDER_KEY.to_owned()),
        ..SmsListFilter::default()
    };
    let newest_sent = operation_context
        .sms_repository
        .list_messages(filter, None, 1)
        .await?;
    Ok(newest_sent
        .messages
        .into_iter()
        .next()
        .and_then(|sent_sms| sent_sms.account))
}

/// The variable Twilio templates sign with; a webhook variable of this name wins.
pub const TWILIO_AUTH_TOKEN_VARIABLE: &str = "twilio_auth_token";

/// Gives an endpoint delivery `vars.twilio_auth_token` from the Twilio provider, as the token
/// of the event's account (`data.account`) or the main account, unless a webhook variable
/// already set it. So `twilio.inbound_sms` and `twilio.status_callback` sign like Twilio does
/// without a variable to keep in step with the provider.
pub async fn default_twilio_auth_token_variable(
    operation_context: &OperationContext,
    template_context: &Value,
    resolved_values: &mut Map<String, Value>,
) -> Result<(), OperationError> {
    if resolved_values.contains_key(TWILIO_AUTH_TOKEN_VARIABLE) {
        return Ok(());
    }
    let directory = TwilioAccountDirectory::load(operation_context).await?;
    let event_account = template_context
        .pointer("/data/account")
        .and_then(Value::as_str);
    resolved_values.insert(
        TWILIO_AUTH_TOKEN_VARIABLE.to_owned(),
        Value::from(directory.account_for(event_account).auth_token.clone()),
    );
    Ok(())
}
