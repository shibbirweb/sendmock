use std::collections::BTreeMap;

use serde_json::{Value, json};

use super::sslcommerz_call::{SSLCOMMERZ_PROVIDER_KEY, SslcommerzCall};
use super::sslcommerz_refunds::{query_refund, refund_transaction};
use super::sslcommerz_session::init_session;
use super::sslcommerz_transaction_query::{query_by_session_key, query_by_tran_id};
use super::sslcommerz_validation::validate_order;
use crate::payments::find_payment_gateway;
use crate::providers::{
    ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute,
    read_provider_form_fields,
};
use crate::{OperationContext, OperationError};

const SSLCOMMERZ_HOSTS: [&str; 2] = ["sandbox.sslcommerz.com", "securepay.sslcommerz.com"];
/// The APIs served; on a shared provider port, other paths belong to others.
const SSLCOMMERZ_RESOURCE_PATHS: [&str; 2] = ["/gwprocess/v4/", "/validator/api/"];

fn is_sslcommerz_request(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> bool {
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => provider_key == SSLCOMMERZ_PROVIDER_KEY,
        ProviderRoute::ProviderPort => {
            request
                .host()
                .is_some_and(|request_host| SSLCOMMERZ_HOSTS.contains(&request_host))
                || SSLCOMMERZ_RESOURCE_PATHS
                    .iter()
                    .any(|resource_path| request.path.starts_with(resource_path))
        }
    }
}

/// The query's fields, then the form body's (URL-encoded, or multipart as SSLCommerz's own
/// Node package sends it), which win on a clash.
fn read_request_fields(request: &ProviderHttpRequest) -> BTreeMap<String, String> {
    let query_fields: Vec<(String, String)> =
        serde_urlencoded::from_str(request.query_string.as_deref().unwrap_or_default())
            .unwrap_or_default();
    query_fields
        .into_iter()
        .chain(read_provider_form_fields(request))
        .collect()
}

/// `merchantTransIDvalidationAPI.php` serves refunds and transaction queries, told apart by
/// the fields sent, as SSLCommerz tells them apart.
async fn answer_merchant_api(
    sslcommerz_call: &SslcommerzCall<'_>,
) -> Result<Value, OperationError> {
    if !sslcommerz_call.has_store_credentials() {
        return Ok(json!({"APIConnect": "FAILED"}));
    }
    if let Some(refund_ref_id) = sslcommerz_call.read_field("refund_ref_id") {
        return query_refund(sslcommerz_call, refund_ref_id).await;
    }
    if sslcommerz_call.read_field("bank_tran_id").is_some() {
        return refund_transaction(sslcommerz_call).await;
    }
    if let Some(session_key) = sslcommerz_call.read_field("sessionkey") {
        return query_by_session_key(sslcommerz_call, session_key).await;
    }
    if let Some(tran_id) = sslcommerz_call.read_field("tran_id") {
        return query_by_tran_id(sslcommerz_call, tran_id).await;
    }
    Ok(json!({"APIConnect": "INVALID_REQUEST"}))
}

async fn route_sslcommerz_request(
    sslcommerz_call: &SslcommerzCall<'_>,
    path: &str,
) -> Result<(u16, Value), OperationError> {
    let path_segments: Vec<&str> = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    match path_segments.as_slice() {
        ["gwprocess", "v4", "api.php"] => Ok((200, init_session(sslcommerz_call).await?)),
        ["validator", "api", "validationserverAPI.php"] => {
            Ok((200, validate_order(sslcommerz_call).await?))
        }
        ["validator", "api", "merchantTransIDvalidationAPI.php"] => {
            Ok((200, answer_merchant_api(sslcommerz_call).await?))
        }
        _ => Ok((
            404,
            json!({"status": "FAILED", "failedreason": "Unknown API path"}),
        )),
    }
}

/// The gateway's secrets and the password the request sent, which the request log masks.
fn collect_secret_values(sslcommerz_call: &SslcommerzCall<'_>) -> Vec<String> {
    let mut secret_values: Vec<String> = sslcommerz_call
        .gateway_fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect();
    secret_values.extend(
        sslcommerz_call
            .read_field("store_passwd")
            .map(str::to_owned),
    );
    secret_values
}

/// SSLCommerz's API from the `sslcommerz` gateway while it is enabled; `None` for other
/// requests.
pub async fn answer_sslcommerz_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !is_sslcommerz_request(provider_route, request) {
        return Ok(None);
    }
    let Ok(sslcommerz_gateway) =
        find_payment_gateway(operation_context, SSLCOMMERZ_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !sslcommerz_gateway.fields.is_enabled {
        return Ok(None);
    }
    let sslcommerz_call = SslcommerzCall {
        operation_context,
        gateway_fields: &sslcommerz_gateway.fields,
        request_fields: read_request_fields(request),
    };
    let (status, body) = route_sslcommerz_request(&sslcommerz_call, &request.path).await?;
    Ok(Some(ProviderOutcome {
        response: ProviderHttpResponse {
            status,
            headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
            body: body.to_string(),
        },
        provider_key: Some(SSLCOMMERZ_PROVIDER_KEY.to_owned()),
        created_sms_id: None,
        secret_values: collect_secret_values(&sslcommerz_call),
    }))
}
