use std::collections::BTreeMap;

use serde_json::{Value, json};

use super::sslcommerz_call::{SSLCOMMERZ_PROVIDER_KEY, SslcommerzCall};
use super::sslcommerz_session::init_session;
use super::sslcommerz_validation::validate_order;
use crate::payments::find_payment_gateway;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
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

fn read_form_fields(form_text: &[u8]) -> Vec<(String, String)> {
    serde_urlencoded::from_bytes(form_text).unwrap_or_default()
}

/// The query's fields, then the form body's, which win on a clash.
fn read_request_fields(request: &ProviderHttpRequest) -> BTreeMap<String, String> {
    let query_fields = read_form_fields(
        request
            .query_string
            .as_deref()
            .unwrap_or_default()
            .as_bytes(),
    );
    query_fields
        .into_iter()
        .chain(read_form_fields(&request.body))
        .collect()
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
