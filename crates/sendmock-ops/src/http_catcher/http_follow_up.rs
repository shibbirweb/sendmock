//! A response rule's follow-up webhook (PL-21.4): after the rule answers, a webhook rendered
//! with any template goes to a URL from a template or to a webhook endpoint, after a delay.

use schemars::JsonSchema;
use sendmock_core::{StandardTemplateFunctions, TemplateEscape, format_rfc3339, render_template};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::http_catcher_wire::{CapturedHttpRequest, HttpMockResponse};
use super::http_response_rules::HttpResponseRule;
use crate::webhooks::{FollowUpOrder, FollowUpTarget, queue_follow_up_delivery};
use crate::{AppEvent, OperationContext, OperationError};

/// The longest a follow-up waits after the answer: ten minutes.
const LONGEST_FOLLOW_UP_DELAY_MS: u32 = 600_000;
/// The event a follow-up renders against.
const FOLLOW_UP_EVENT_TYPE: &str = "http.captured";

/// The webhook a rule sends after it answers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct HttpFollowUpWebhook {
    /// A URL template, such as `{{ request.form.StatusCallback }}`; empty when an endpoint is
    /// chosen.
    #[serde(default)]
    pub url: String,
    /// A webhook endpoint's ID: its URL and retry policy are used instead of `url`.
    #[serde(default)]
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub endpoint_id: Option<String>,
    /// The webhook template its body and headers render with, such as `twilio.status_callback`;
    /// vendor templates sign as the vendor does.
    pub template_id: String,
    /// How long after the answer it is sent, in milliseconds (0 to 600,000).
    #[serde(default)]
    pub delay_ms: u32,
}

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// The editor's rules for a follow-up.
pub fn check_follow_up(follow_up: &HttpFollowUpWebhook) -> Result<(), OperationError> {
    if follow_up.template_id.trim().is_empty() {
        return Err(field_error("follow_up.template_id", "Choose a template"));
    }
    if follow_up.endpoint_id.is_none() && follow_up.url.trim().is_empty() {
        return Err(field_error(
            "follow_up.url",
            "Enter a URL or choose an endpoint",
        ));
    }
    if follow_up.delay_ms > LONGEST_FOLLOW_UP_DELAY_MS {
        return Err(field_error("follow_up.delay_ms", "Use 0 to 600,000 ms"));
    }
    Ok(())
}

/// The account a Twilio-style path names (`/Accounts/AC.../Calls.json`), so Twilio templates
/// sign with that account's token.
fn read_path_account(request_path: &str) -> Option<&str> {
    let mut path_segments = request_path.split('/');
    path_segments.find(|segment| *segment == "Accounts")?;
    path_segments
        .next()
        .map(|account_segment| account_segment.trim_end_matches(".json"))
        .filter(|account_sid| account_sid.starts_with("AC"))
}

/// What the follow-up's template reads under `data`: the request as the reply templates see it
/// and the answer the rule gave.
fn build_follow_up_data(
    response_context: &Value,
    captured_request: &CapturedHttpRequest,
    answer: &HttpMockResponse,
    rule_name: &str,
) -> Value {
    json!({
        "request": response_context["request"],
        "response": {
            "status_code": answer.status_code,
            "headers": answer.headers,
            "body": answer.body,
            "json": serde_json::from_str::<Value>(&answer.body).unwrap_or(Value::Null),
        },
        "request_id": captured_request.id,
        "account": read_path_account(&captured_request.path),
        "bin_name": captured_request.bin_name,
        "provider_key": captured_request.provider_key,
        "rule_name": rule_name,
    })
}

async fn choose_target(
    operation_context: &OperationContext,
    follow_up: &HttpFollowUpWebhook,
    response_context: &Value,
    target_name: String,
) -> Result<Option<FollowUpTarget>, OperationError> {
    if let Some(endpoint_id) = &follow_up.endpoint_id {
        return Ok(operation_context
            .webhook_endpoint_repository
            .find_endpoint(endpoint_id)
            .await?
            .map(FollowUpTarget::Endpoint));
    }
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    let rendered_url = render_template(
        &follow_up.url,
        response_context,
        &template_functions,
        TemplateEscape::None,
    )
    .text
    .trim()
    .to_owned();
    Ok((!rendered_url.is_empty()).then_some(FollowUpTarget::Url {
        url: rendered_url,
        target_name,
    }))
}

/// Queues the rule's follow-up for a request it answered; a URL that renders empty or a
/// deleted endpoint sends nothing.
pub async fn send_rule_follow_up(
    operation_context: &OperationContext,
    answering_rule: &HttpResponseRule,
    captured_request: &CapturedHttpRequest,
    answer: &HttpMockResponse,
    response_context: &Value,
) -> Result<(), OperationError> {
    let Some(follow_up) = &answering_rule.follow_up else {
        return Ok(());
    };
    let target_name = format!("Bin {}: {}", captured_request.bin_name, answering_rule.name);
    let Some(target) =
        choose_target(operation_context, follow_up, response_context, target_name).await?
    else {
        tracing::warn!(rule = %answering_rule.name, "the follow-up webhook has no URL to send to");
        return Ok(());
    };
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let app_event = AppEvent {
        id: format!("evt_{}", operation_context.id_generator.generate_id()),
        event_type: FOLLOW_UP_EVENT_TYPE.to_owned(),
        created_at: format_rfc3339(now_unix_ms),
        data: build_follow_up_data(
            response_context,
            captured_request,
            answer,
            &answering_rule.name,
        ),
    };
    queue_follow_up_delivery(
        operation_context,
        FollowUpOrder {
            app_event,
            target,
            template_id: follow_up.template_id.clone(),
            delay_ms: follow_up.delay_ms,
            subject_id: captured_request.id.clone(),
            rule_id: answering_rule.id.clone(),
        },
    )
    .await?;
    Ok(())
}
