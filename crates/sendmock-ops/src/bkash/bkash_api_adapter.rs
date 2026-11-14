use serde_json::{Map, Value, json};

use super::bkash_call::{BKASH_PROVIDER_KEY, BkashCall};
use super::bkash_execution::{execute_payment, query_payment};
use super::bkash_payment::create_payment;
use super::bkash_refunds::refund_payment;
use super::bkash_token::{grant_token, refresh_token};
use crate::payments::find_payment_gateway;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

const BKASH_HOSTS: [&str; 2] = ["tokenized.sandbox.bka.sh", "tokenized.pay.bka.sh"];
/// bKash's base URL carries an API version (`/v1.2.0-beta`) before this.
const CHECKOUT_PATH_MARKER: &str = "/tokenized/checkout/";

fn is_bkash_request(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> bool {
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => provider_key == BKASH_PROVIDER_KEY,
        ProviderRoute::ProviderPort => {
            request
                .host()
                .is_some_and(|request_host| BKASH_HOSTS.contains(&request_host))
                || request.path.contains(CHECKOUT_PATH_MARKER)
        }
    }
}

/// The path after `/tokenized/checkout/`, whatever version comes before it.
fn read_checkout_path(path: &str) -> Option<&str> {
    path.split_once(CHECKOUT_PATH_MARKER)
        .map(|(_, checkout_path)| checkout_path.trim_end_matches('/'))
}

async fn route_bkash_request(bkash_call: &BkashCall<'_>) -> Result<(u16, Value), OperationError> {
    let answer = match read_checkout_path(&bkash_call.request.path) {
        Some("token/grant") => grant_token(bkash_call),
        Some("token/refresh") => refresh_token(bkash_call),
        Some("create") => create_payment(bkash_call).await?,
        Some("execute") => execute_payment(bkash_call).await?,
        Some("payment/status") => query_payment(bkash_call).await?,
        Some("payment/refund") => refund_payment(bkash_call).await?,
        _ => {
            return Ok((
                404,
                json!({"statusCode": "404", "statusMessage": "Not Found"}),
            ));
        }
    };
    Ok((200, answer))
}

/// The gateway's secrets and the password and token the request sent, which the request log
/// masks.
fn collect_secret_values(bkash_call: &BkashCall<'_>) -> Vec<String> {
    let mut secret_values: Vec<String> = bkash_call
        .gateway_fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect();
    for header_name in ["password", "authorization"] {
        secret_values.extend(bkash_call.request.header(header_name).map(str::to_owned));
    }
    secret_values
}

/// bKash's tokenized checkout API from the `bkash` gateway while it is enabled; `None` for
/// other requests.
pub async fn answer_bkash_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !is_bkash_request(provider_route, request) {
        return Ok(None);
    }
    let Ok(bkash_gateway) = find_payment_gateway(operation_context, BKASH_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !bkash_gateway.fields.is_enabled {
        return Ok(None);
    }
    let body_fields: Map<String, Value> = serde_json::from_slice(&request.body).unwrap_or_default();
    let bkash_call = BkashCall {
        operation_context,
        gateway_fields: &bkash_gateway.fields,
        request,
        body_fields,
    };
    let (status, body) = route_bkash_request(&bkash_call).await?;
    Ok(Some(ProviderOutcome {
        response: ProviderHttpResponse {
            status,
            headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
            body: body.to_string(),
        },
        provider_key: Some(BKASH_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values: collect_secret_values(&bkash_call),
    }))
}
