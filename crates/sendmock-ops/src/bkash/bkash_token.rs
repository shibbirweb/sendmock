use serde_json::{Value, json};

use super::bkash_call::BkashCall;
use super::bkash_error::{BkashError, mark_successful};

const TOKEN_LIFETIME_SECONDS: u32 = 3600;

fn issue_tokens(bkash_call: &BkashCall<'_>) -> Value {
    let id_generator = &bkash_call.operation_context.id_generator;
    mark_successful(json!({
        "id_token": format!("eyJraWQiOiJzZW5kbW9jayJ9.{}", id_generator.generate_id()),
        "token_type": "Bearer",
        "expires_in": TOKEN_LIFETIME_SECONDS,
        "refresh_token": format!("sendmock-refresh-{}", id_generator.generate_id()),
    }))
}

/// `POST /tokenized/checkout/token/grant`: an id token for the merchant's username and
/// password headers and the app key and secret.
pub fn grant_token(bkash_call: &BkashCall<'_>) -> Value {
    if !bkash_call.has_merchant_login() {
        return BkashError::INVALID_USERNAME_OR_PASSWORD.describe();
    }
    if !bkash_call.has_app_credentials_in_body() {
        return BkashError::INVALID_APP_KEY.describe();
    }
    issue_tokens(bkash_call)
}

/// `POST /tokenized/checkout/token/refresh`: a new id token for a refresh token.
pub fn refresh_token(bkash_call: &BkashCall<'_>) -> Value {
    if !bkash_call.has_merchant_login() {
        return BkashError::INVALID_USERNAME_OR_PASSWORD.describe();
    }
    if !bkash_call.has_app_credentials_in_body() {
        return BkashError::INVALID_APP_KEY.describe();
    }
    if bkash_call.read_field("refresh_token").is_none() {
        return BkashError::INVALID_REQUEST_BODY.describe();
    }
    issue_tokens(bkash_call)
}
