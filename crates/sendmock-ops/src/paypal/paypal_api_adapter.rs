use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::Value;

use super::paypal_call::{PAYPAL_PROVIDER_KEY, PayPalAnswer, PayPalCall};
use super::paypal_error::PayPalError;
use super::paypal_ipn_validation::{build_ipn_response, is_genuine_ipn, is_ipn_postback_path};
use super::paypal_orders::{capture_order, create_order, retrieve_order};
use super::paypal_refunds::{refund_capture, retrieve_capture, retrieve_refund};
use super::paypal_token::issue_access_token;
use super::paypal_webhook_verification::verify_webhook_signature;
use crate::payments::find_payment_gateway;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

const PAYPAL_API_HOSTS: [&str; 4] = [
    "api-m.sandbox.paypal.com",
    "api-m.paypal.com",
    "api.sandbox.paypal.com",
    "api.paypal.com",
];
/// The resources served; on a shared provider port, other paths belong to others.
const PAYPAL_RESOURCE_PATHS: [&str; 4] = [
    "/v1/oauth2/token",
    "/v1/notifications/verify-webhook-signature",
    "/v2/checkout/orders",
    "/v2/payments/",
];

fn is_paypal_request(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> bool {
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => provider_key == PAYPAL_PROVIDER_KEY,
        ProviderRoute::ProviderPort => {
            request
                .host()
                .is_some_and(|request_host| PAYPAL_API_HOSTS.contains(&request_host))
                || PAYPAL_RESOURCE_PATHS
                    .iter()
                    .any(|resource_path| request.path.starts_with(resource_path))
                || is_ipn_postback_path(&request.path)
        }
    }
}

/// What the request authenticates with: a Bearer token, or the app's id and secret as Basic.
#[derive(Debug, Default)]
struct PayPalCredentials {
    bearer_token: Option<String>,
    basic_pair: Option<(String, String)>,
    /// The raw header value, masked in the request log.
    authorization: Option<String>,
}

fn read_credentials(request: &ProviderHttpRequest) -> PayPalCredentials {
    let Some(authorization) = request.header("authorization") else {
        return PayPalCredentials::default();
    };
    let bearer_token = authorization
        .strip_prefix("Bearer ")
        .map(|token| token.trim().to_owned())
        .filter(|token| !token.is_empty());
    let basic_pair = authorization
        .strip_prefix("Basic ")
        .and_then(|encoded_pair| STANDARD.decode(encoded_pair.trim()).ok())
        .and_then(|decoded_pair| {
            let pair_text = String::from_utf8_lossy(&decoded_pair).into_owned();
            pair_text
                .split_once(':')
                .map(|(client_id, client_secret)| (client_id.to_owned(), client_secret.to_owned()))
        })
        .filter(|(client_id, client_secret)| !client_id.is_empty() && !client_secret.is_empty());
    PayPalCredentials {
        bearer_token,
        basic_pair,
        authorization: Some(authorization.to_owned()),
    }
}

fn split_path(path: &str) -> Vec<&str> {
    path.split('/')
        .filter(|segment| !segment.is_empty())
        .collect()
}

async fn route_paypal_request(
    paypal_call: &PayPalCall<'_>,
    method: &str,
    path: &str,
) -> PayPalAnswer {
    match (method, split_path(path).as_slice()) {
        ("POST", ["v2", "checkout", "orders"]) => create_order(paypal_call).await,
        ("GET", ["v2", "checkout", "orders", order_id]) => {
            retrieve_order(paypal_call, order_id).await
        }
        ("POST", ["v2", "checkout", "orders", order_id, "capture"]) => {
            capture_order(paypal_call, order_id).await
        }
        ("GET", ["v2", "payments", "captures", capture_id]) => {
            retrieve_capture(paypal_call, capture_id).await
        }
        ("POST", ["v2", "payments", "captures", capture_id, "refund"]) => {
            refund_capture(paypal_call, capture_id).await
        }
        ("GET", ["v2", "payments", "refunds", refund_id]) => {
            retrieve_refund(paypal_call, refund_id).await
        }
        ("POST", ["v1", "notifications", "verify-webhook-signature"]) => {
            verify_webhook_signature(paypal_call).await
        }
        _ => Err(PayPalError::unknown_path()),
    }
}

async fn answer_paypal_call(
    paypal_call: &PayPalCall<'_>,
    request: &ProviderHttpRequest,
    credentials: &PayPalCredentials,
) -> PayPalAnswer {
    let method = request.method.to_ascii_uppercase();
    if method == "POST" && request.path.trim_end_matches('/') == "/v1/oauth2/token" {
        return issue_access_token(paypal_call, credentials.basic_pair.is_some(), &request.body);
    }
    if credentials.bearer_token.is_none() && credentials.basic_pair.is_none() {
        return Err(PayPalError::authentication_failure());
    }
    route_paypal_request(paypal_call, &method, &request.path).await
}

fn build_paypal_call<'call>(
    operation_context: &'call OperationContext,
    request: &ProviderHttpRequest,
) -> PayPalCall<'call> {
    let is_json_body = !request.path.ends_with("/oauth2/token")
        && !request.body.iter().all(u8::is_ascii_whitespace);
    let parsed_body = if is_json_body {
        serde_json::from_slice::<Value>(&request.body).ok()
    } else {
        Some(Value::Null)
    };
    PayPalCall {
        operation_context,
        has_malformed_body: parsed_body.is_none(),
        request_body: parsed_body.unwrap_or(Value::Null),
        prefers_representation: request
            .header("prefer")
            .is_some_and(|prefer| prefer.contains("return=representation")),
    }
}

fn build_paypal_response(debug_id: &str, paypal_answer: PayPalAnswer) -> ProviderHttpResponse {
    let (status, mut body) = match paypal_answer {
        Ok(paypal_reply) => (paypal_reply.status, paypal_reply.body),
        Err(paypal_error) => (paypal_error.status, paypal_error.body),
    };
    if status >= 400 && body.get("name").is_some() {
        body["debug_id"] = Value::from(debug_id);
    }
    ProviderHttpResponse {
        status,
        headers: vec![
            ("Content-Type".to_owned(), "application/json".to_owned()),
            ("Paypal-Debug-Id".to_owned(), debug_id.to_owned()),
        ],
        body: body.to_string(),
    }
}

/// The secrets the request log masks: the gateway's, the app's secret and tokens, and the
/// token answered.
fn collect_secret_values(
    gateway_secrets: Vec<String>,
    credentials: PayPalCredentials,
    response: &ProviderHttpResponse,
) -> Vec<String> {
    let mut secret_values = gateway_secrets;
    secret_values.extend(credentials.bearer_token);
    secret_values.extend(
        credentials
            .basic_pair
            .map(|(_, client_secret)| client_secret),
    );
    secret_values.extend(credentials.authorization);
    let issued_token =
        serde_json::from_str::<Value>(&response.body)
            .ok()
            .and_then(|response_body| {
                response_body
                    .get("access_token")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            });
    secret_values.extend(issued_token);
    secret_values
}

/// PayPal's REST API and IPN postback from the `paypal` gateway while it is enabled; `None` for
/// other requests.
pub async fn answer_paypal_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !is_paypal_request(provider_route, request) {
        return Ok(None);
    }
    let Ok(paypal_gateway) = find_payment_gateway(operation_context, PAYPAL_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !paypal_gateway.fields.is_enabled {
        return Ok(None);
    }
    if is_ipn_postback_path(&request.path) {
        let is_verified = request.method.eq_ignore_ascii_case("POST")
            && is_genuine_ipn(operation_context, &request.body).await?;
        return Ok(Some(ProviderOutcome {
            response: build_ipn_response(is_verified),
            provider_key: Some(PAYPAL_PROVIDER_KEY.to_owned()),
            created_sms_id: None,
            secret_values: Vec::new(),
        }));
    }
    let credentials = read_credentials(request);
    let paypal_call = build_paypal_call(operation_context, request);
    let paypal_answer = answer_paypal_call(&paypal_call, request, &credentials).await;
    let debug_id = format!("{:x}", operation_context.random_source.next_u64())
        .chars()
        .take(13)
        .collect::<String>();
    let response = build_paypal_response(&debug_id, paypal_answer);
    let gateway_secrets = paypal_gateway
        .fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect();
    let secret_values = collect_secret_values(gateway_secrets, credentials, &response);
    Ok(Some(ProviderOutcome {
        response,
        provider_key: Some(PAYPAL_PROVIDER_KEY.to_owned()),
        created_sms_id: None,
        secret_values,
    }))
}
