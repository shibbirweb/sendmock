use serde_json::json;

use super::paypal_call::{PayPalAnswer, PayPalCall, PayPalReply};
use super::paypal_error::PayPalError;

/// PayPal's sandbox app id, which every token names.
const SANDBOX_APP_ID: &str = "APP-80W284485P519543T";
const TOKEN_LIFETIME_SECONDS: u32 = 32_400;
const TOKEN_SCOPE: &str = "https://uri.paypal.com/services/payments/payment https://uri.paypal.com/services/payments/refund https://uri.paypal.com/services/payments/realtimepayment openid";

/// `POST /v1/oauth2/token` with any client id and secret, as each PayPal app has its own.
pub fn issue_access_token(
    paypal_call: &PayPalCall<'_>,
    has_client_credentials: bool,
    form_body: &[u8],
) -> PayPalAnswer {
    if !has_client_credentials {
        return Err(PayPalError::invalid_client());
    }
    let form_pairs: Vec<(String, String)> =
        serde_urlencoded::from_bytes(form_body).unwrap_or_default();
    let is_client_credentials_grant = form_pairs.iter().any(|(field_name, field_value)| {
        field_name == "grant_type" && field_value == "client_credentials"
    });
    if !is_client_credentials_grant {
        return Err(PayPalError::unsupported_grant_type());
    }
    let operation_context = paypal_call.operation_context;
    let token_suffix = operation_context.id_generator.generate_id().to_string();
    Ok(PayPalReply {
        status: 200,
        body: json!({
            "scope": TOKEN_SCOPE,
            "access_token": format!("A21AA{token_suffix}"),
            "token_type": "Bearer",
            "app_id": SANDBOX_APP_ID,
            "expires_in": TOKEN_LIFETIME_SECONDS,
            "nonce": format!("{}{token_suffix}", sendmock_core::format_rfc3339(operation_context.clock.now_unix_ms())),
        }),
    })
}
