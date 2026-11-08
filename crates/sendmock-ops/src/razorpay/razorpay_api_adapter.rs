use serde_json::json;

use super::razorpay_call::{RAZORPAY_PROVIDER_KEY, RazorpayCall, read_body_fields};
use super::razorpay_error::{RazorpayAnswer, RazorpayError};
use super::razorpay_orders::{create_order, fetch_order};
use super::razorpay_payments::{
    capture_payment, fetch_payment, fetch_refund, list_payment_refunds, refund_payment,
};
use crate::payments::find_payment_gateway;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

const RAZORPAY_API_HOST: &str = "api.razorpay.com";
/// On a shared provider port, Stripe answers `/v1/refunds` too, so only Razorpay's own
/// refund ids are claimed.
const RAZORPAY_RESOURCE_PATHS: [&str; 3] = ["/v1/orders", "/v1/payments/", "/v1/refunds/rfnd_"];

fn is_razorpay_request(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> bool {
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => provider_key == RAZORPAY_PROVIDER_KEY,
        ProviderRoute::ProviderPort => {
            request.host() == Some(RAZORPAY_API_HOST)
                || RAZORPAY_RESOURCE_PATHS
                    .iter()
                    .any(|resource_path| request.path.starts_with(resource_path))
        }
    }
}

async fn route_razorpay_request(
    razorpay_call: &RazorpayCall<'_>,
) -> Result<RazorpayAnswer, OperationError> {
    if let Err(razorpay_error) = razorpay_call.check_key() {
        return Ok(Err(razorpay_error));
    }
    let path_segments: Vec<&str> = razorpay_call
        .request
        .path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    match (
        razorpay_call.request.method.as_str(),
        path_segments.as_slice(),
    ) {
        ("POST", ["v1", "orders"]) => create_order(razorpay_call).await,
        ("GET", ["v1", "orders", order_id]) => fetch_order(razorpay_call, order_id, false).await,
        ("GET", ["v1", "orders", order_id, "payments"]) => {
            fetch_order(razorpay_call, order_id, true).await
        }
        ("GET", ["v1", "payments", payment_id]) => fetch_payment(razorpay_call, payment_id).await,
        ("POST", ["v1", "payments", payment_id, "capture"]) => {
            capture_payment(razorpay_call, payment_id).await
        }
        ("POST", ["v1", "payments", payment_id, "refund"]) => {
            refund_payment(razorpay_call, payment_id).await
        }
        ("GET", ["v1", "payments", payment_id, "refunds"]) => {
            list_payment_refunds(razorpay_call, payment_id).await
        }
        ("GET", ["v1", "refunds", refund_id]) => fetch_refund(razorpay_call, refund_id).await,
        _ => Ok(Err(RazorpayError::unknown_url())),
    }
}

fn collect_secret_values(razorpay_call: &RazorpayCall<'_>) -> Vec<String> {
    let mut secret_values: Vec<String> = razorpay_call
        .gateway_fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect();
    secret_values.extend(
        razorpay_call
            .request
            .header("authorization")
            .map(str::to_owned),
    );
    secret_values
}

/// Razorpay's orders, payments and refunds from the `razorpay` gateway while it is enabled;
/// `None` for other requests.
pub async fn answer_razorpay_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !is_razorpay_request(provider_route, request) {
        return Ok(None);
    }
    let Ok(razorpay_gateway) = find_payment_gateway(operation_context, RAZORPAY_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !razorpay_gateway.fields.is_enabled {
        return Ok(None);
    }
    let razorpay_call = RazorpayCall {
        operation_context,
        gateway_fields: &razorpay_gateway.fields,
        request,
        body_fields: read_body_fields(request),
    };
    let (status, body) = route_razorpay_request(&razorpay_call)
        .await?
        .unwrap_or_else(|razorpay_error| (razorpay_error.status, razorpay_error.describe()));
    Ok(Some(ProviderOutcome {
        response: ProviderHttpResponse {
            status,
            headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
            body: if body.is_null() {
                json!({}).to_string()
            } else {
                body.to_string()
            },
        },
        provider_key: Some(RAZORPAY_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values: collect_secret_values(&razorpay_call),
    }))
}
