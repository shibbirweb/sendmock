use serde_json::{Map, Value, json};

use super::paddle_adjustments::create_adjustment;
use super::paddle_call::{PADDLE_PROVIDER_KEY, PaddleCall};
use super::paddle_error::{PaddleAnswer, PaddleError};
use super::paddle_transactions::{create_transaction, get_transaction, list_transactions};
use crate::payments::find_payment_gateway;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

const PADDLE_API_HOSTS: [&str; 2] = ["sandbox-api.paddle.com", "api.paddle.com"];
const PADDLE_RESOURCE_PATHS: [&str; 2] = ["/transactions", "/adjustments"];

fn is_paddle_request(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> bool {
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => provider_key == PADDLE_PROVIDER_KEY,
        ProviderRoute::ProviderPort => {
            request
                .host()
                .is_some_and(|request_host| PADDLE_API_HOSTS.contains(&request_host))
                || PADDLE_RESOURCE_PATHS
                    .iter()
                    .any(|resource_path| request.path.starts_with(resource_path))
        }
    }
}

async fn route_paddle_request(
    paddle_call: &PaddleCall<'_>,
) -> Result<PaddleAnswer, OperationError> {
    if let Err(paddle_error) = paddle_call.check_api_key() {
        return Ok(Err(paddle_error));
    }
    let path_segments: Vec<&str> = paddle_call
        .request
        .path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    match (
        paddle_call.request.method.as_str(),
        path_segments.as_slice(),
    ) {
        ("POST", ["transactions"]) => create_transaction(paddle_call).await,
        ("GET", ["transactions"]) => list_transactions(paddle_call).await,
        ("GET", ["transactions", transaction_id]) => {
            get_transaction(paddle_call, transaction_id).await
        }
        ("POST", ["adjustments"]) => create_adjustment(paddle_call).await,
        _ => Ok(Err(PaddleError::new(
            404,
            "not_found",
            "The requested URL was not found",
        ))),
    }
}

/// Paddle wraps every answer: `data` and `meta.request_id`, or `error` and `meta`.
fn wrap_answer(paddle_answer: PaddleAnswer, request_id: &str) -> (u16, Value) {
    match paddle_answer {
        Ok((status, data)) => (
            status,
            json!({ "data": data, "meta": { "request_id": request_id } }),
        ),
        Err(paddle_error) => (paddle_error.status, paddle_error.describe(request_id)),
    }
}

fn collect_secret_values(paddle_call: &PaddleCall<'_>) -> Vec<String> {
    let mut secret_values: Vec<String> = paddle_call
        .gateway_fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect();
    secret_values.extend(
        paddle_call
            .request
            .header("authorization")
            .map(str::to_owned),
    );
    secret_values
}

/// Paddle Billing's transactions and refunds from the `paddle` gateway while it is enabled;
/// `None` for other requests.
pub async fn answer_paddle_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !is_paddle_request(provider_route, request) {
        return Ok(None);
    }
    let Ok(paddle_gateway) = find_payment_gateway(operation_context, PADDLE_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !paddle_gateway.fields.is_enabled {
        return Ok(None);
    }
    let body_fields: Map<String, Value> = serde_json::from_slice(&request.body).unwrap_or_default();
    let paddle_call = PaddleCall {
        operation_context,
        gateway_fields: &paddle_gateway.fields,
        request,
        body_fields,
    };
    let request_id = operation_context
        .id_generator
        .generate_id()
        .to_string()
        .to_ascii_lowercase();
    let (status, body) = wrap_answer(route_paddle_request(&paddle_call).await?, &request_id);
    Ok(Some(ProviderOutcome {
        response: ProviderHttpResponse {
            status,
            headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
            body: body.to_string(),
        },
        provider_key: Some(PADDLE_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values: collect_secret_values(&paddle_call),
    }))
}
