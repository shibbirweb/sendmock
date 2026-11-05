use super::custom_gateway_call::{CustomGatewayAnswer, CustomGatewayCall, CustomGatewayRefusal};
use super::custom_gateway_session::init_custom_checkout;
use super::custom_gateway_validation::validate_custom_payment;
use crate::payments::{PaymentGatewayFields, find_payment_gateway};
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

/// The two calls every custom gateway serves.
enum CustomGatewayRoute<'path> {
    Checkout,
    Validation { payment_reference: &'path str },
}

fn match_route(request: &ProviderHttpRequest) -> Option<CustomGatewayRoute<'_>> {
    let path_segments: Vec<&str> = request
        .path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    match (request.method.as_str(), path_segments.as_slice()) {
        ("POST", ["checkout"]) => Some(CustomGatewayRoute::Checkout),
        ("GET", ["payments", payment_reference]) => {
            Some(CustomGatewayRoute::Validation { payment_reference })
        }
        _ => None,
    }
}

async fn answer_route(
    custom_gateway_call: &CustomGatewayCall<'_>,
    route: CustomGatewayRoute<'_>,
) -> Result<CustomGatewayAnswer, OperationError> {
    if let Some(credential_name) = custom_gateway_call.find_wrong_credential() {
        let refusal = CustomGatewayRefusal {
            status: 401,
            code: "invalid_credentials",
            message: format!("{credential_name} does not match the gateway's credential"),
            field: Some(credential_name.to_owned()),
        };
        return Ok(refusal.to_answer());
    }
    match route {
        CustomGatewayRoute::Checkout => init_custom_checkout(custom_gateway_call).await,
        CustomGatewayRoute::Validation { payment_reference } => {
            validate_custom_payment(custom_gateway_call, payment_reference).await
        }
    }
}

fn list_secret_values(gateway_fields: &PaymentGatewayFields) -> Vec<String> {
    gateway_fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect()
}

/// A custom gateway's session init and validation under `/providers/<gatewayKey>/`, while it
/// is enabled; `None` for built-ins and other paths.
pub async fn answer_custom_gateway_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let ProviderRoute::Prefixed(gateway_key) = provider_route else {
        return Ok(None);
    };
    let Some(route) = match_route(request) else {
        return Ok(None);
    };
    let Ok(payment_gateway) = find_payment_gateway(operation_context, gateway_key).await else {
        return Ok(None);
    };
    if payment_gateway.is_builtin || !payment_gateway.fields.is_enabled {
        return Ok(None);
    }
    let gateway_fields = &payment_gateway.fields;
    let answer = match CustomGatewayCall::new(operation_context, gateway_fields, request) {
        Ok(custom_gateway_call) => answer_route(&custom_gateway_call, route).await?,
        Err(refusal) => refusal.to_answer(),
    };
    Ok(Some(ProviderOutcome {
        response: ProviderHttpResponse {
            status: answer.status,
            headers: vec![("Content-Type".to_owned(), answer.content_type)],
            body: answer.body,
        },
        provider_key: Some(gateway_key.to_owned()),
        created_sms_id: None,
        secret_values: list_secret_values(gateway_fields),
    }))
}
