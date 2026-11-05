use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::Value;

use super::stripe_call::{StripeAnswer, StripeCall};
use super::stripe_checkout_sessions::{
    create_checkout_session, expire_checkout_session, list_checkout_session_line_items,
    retrieve_checkout_session,
};
use super::stripe_error::StripeError;
use super::stripe_fields::StripeFields;
use super::stripe_form_decoder::decode_stripe_form;
use super::stripe_object_store::STRIPE_PROVIDER_KEY;
use super::stripe_payment_intents::{
    cancel_payment_intent, capture_payment_intent, confirm_existing_payment_intent,
    create_payment_intent, retrieve_payment_intent,
};
use super::stripe_refunds::{create_refund, retrieve_refund};
use crate::payments::find_payment_gateway;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

const STRIPE_API_HOST: &str = "api.stripe.com";
/// The resources served; on a shared provider port, other `/v1/...` paths belong to others.
const STRIPE_RESOURCE_PATHS: [&str; 3] = [
    "/v1/payment_intents",
    "/v1/checkout/sessions",
    "/v1/refunds",
];

fn is_stripe_request(provider_route: ProviderRoute<'_>, request: &ProviderHttpRequest) -> bool {
    match provider_route {
        ProviderRoute::Prefixed(provider_key) => provider_key == STRIPE_PROVIDER_KEY,
        ProviderRoute::ProviderPort => {
            request.host() == Some(STRIPE_API_HOST)
                || STRIPE_RESOURCE_PATHS
                    .iter()
                    .any(|resource_path| request.path.starts_with(resource_path))
        }
    }
}

/// The secret key from `Authorization: Bearer <key>`, or Basic with the key as the user.
fn read_api_key(request: &ProviderHttpRequest) -> Option<String> {
    let authorization = request.header("authorization")?;
    if let Some(bearer_key) = authorization.strip_prefix("Bearer ") {
        return Some(bearer_key.trim().to_owned());
    }
    let decoded_basic = STANDARD
        .decode(authorization.strip_prefix("Basic ")?.trim())
        .ok()?;
    let basic_text = String::from_utf8_lossy(&decoded_basic).into_owned();
    Some(basic_text.split(':').next().unwrap_or_default().to_owned())
}

fn mask_api_key(api_key: &str) -> String {
    let key_prefix: String = api_key.chars().take(8).collect();
    let key_ending: String = api_key
        .chars()
        .skip(api_key.chars().count().saturating_sub(4))
        .collect();
    format!("{key_prefix}****{key_ending}")
}

/// Any test key works, as each Stripe account has its own; a live key is refused and kept
/// nowhere.
fn check_api_key(api_key: Option<&str>) -> Result<(), StripeError> {
    match api_key {
        None | Some("") => Err(StripeError::missing_api_key()),
        Some(api_key) if api_key.starts_with("sk_live_") || api_key.starts_with("rk_live_") => {
            Err(StripeError::invalid_api_key(&mask_api_key(api_key)))
        }
        Some(_) => Ok(()),
    }
}

/// The request's parameters: the query of a `GET`, else the form body.
fn read_stripe_fields(request: &ProviderHttpRequest) -> StripeFields {
    let form_bytes = if request.method.eq_ignore_ascii_case("GET") {
        request
            .query_string
            .clone()
            .unwrap_or_default()
            .into_bytes()
    } else {
        request.body.clone()
    };
    StripeFields::new(decode_stripe_form(&form_bytes))
}

async fn route_stripe_request(
    stripe_call: &StripeCall<'_>,
    method: &str,
    path: &str,
) -> StripeAnswer {
    let path_segments: Vec<&str> = path
        .trim_start_matches("/v1/")
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    match (method, path_segments.as_slice()) {
        ("POST", ["payment_intents"]) => create_payment_intent(stripe_call).await,
        ("GET", ["payment_intents", intent_id]) => {
            retrieve_payment_intent(stripe_call, intent_id).await
        }
        ("POST", ["payment_intents", intent_id, "confirm"]) => {
            confirm_existing_payment_intent(stripe_call, intent_id).await
        }
        ("POST", ["payment_intents", intent_id, "capture"]) => {
            capture_payment_intent(stripe_call, intent_id).await
        }
        ("POST", ["payment_intents", intent_id, "cancel"]) => {
            cancel_payment_intent(stripe_call, intent_id).await
        }
        ("POST", ["checkout", "sessions"]) => create_checkout_session(stripe_call).await,
        ("GET", ["checkout", "sessions", session_id]) => {
            retrieve_checkout_session(stripe_call, session_id).await
        }
        ("GET", ["checkout", "sessions", session_id, "line_items"]) => {
            list_checkout_session_line_items(stripe_call, session_id).await
        }
        ("POST", ["checkout", "sessions", session_id, "expire"]) => {
            expire_checkout_session(stripe_call, session_id).await
        }
        ("POST", ["refunds"]) => create_refund(stripe_call).await,
        ("GET", ["refunds", refund_id]) => retrieve_refund(stripe_call, refund_id).await,
        _ => Err(StripeError::unrecognized_url(method, path)),
    }
}

fn build_stripe_response(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
    stripe_answer: StripeAnswer,
) -> ProviderHttpResponse {
    let (status, body): (u16, Value) = match stripe_answer {
        Ok(stripe_object) => (200, stripe_object),
        Err(stripe_error) => (stripe_error.status, stripe_error.to_body()),
    };
    let mut headers = vec![
        ("Content-Type".to_owned(), "application/json".to_owned()),
        (
            "Request-Id".to_owned(),
            format!("req_{}", operation_context.id_generator.generate_id()),
        ),
    ];
    if let Some(stripe_version) = request.header("stripe-version") {
        headers.push(("Stripe-Version".to_owned(), stripe_version.to_owned()));
    }
    ProviderHttpResponse {
        status,
        headers,
        body: body.to_string(),
    }
}

/// Stripe's API (`api.stripe.com/v1`) from the `stripe` gateway while it is enabled; `None`
/// for other requests. The key, the gateway's secrets and any card data sent are masked in
/// the request log.
pub async fn answer_stripe_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !is_stripe_request(provider_route, request) {
        return Ok(None);
    }
    let Ok(stripe_gateway) = find_payment_gateway(operation_context, STRIPE_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !stripe_gateway.fields.is_enabled {
        return Ok(None);
    }
    let api_key = read_api_key(request);
    let stripe_call = StripeCall {
        operation_context,
        stripe_fields: read_stripe_fields(request),
    };
    let stripe_answer = match check_api_key(api_key.as_deref()) {
        Ok(()) => {
            route_stripe_request(
                &stripe_call,
                &request.method.to_ascii_uppercase(),
                &request.path,
            )
            .await
        }
        Err(key_error) => Err(key_error),
    };
    let mut secret_values: Vec<String> = stripe_gateway
        .fields
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.clone())
        .collect();
    secret_values.extend(api_key.filter(|api_key| !api_key.is_empty()));
    secret_values.extend(
        stripe_call
            .stripe_fields
            .collect_texts(&["payment_method_data"]),
    );
    secret_values.extend(stripe_call.stripe_fields.collect_texts(&["card"]));
    Ok(Some(ProviderOutcome {
        response: build_stripe_response(operation_context, request, stripe_answer),
        provider_key: Some(STRIPE_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values,
    }))
}
