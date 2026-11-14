use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::Deserialize;

use super::delivery_replay_operation::is_signature_header;
use crate::{EditedWebhookRequest, OperationContext, OperationError, WebhookChoice};

/// A request edited before the action sends it (WH-14.4).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookRequestEdit {
    /// The endpoint the edited request goes to.
    pub endpoint_id: String,
    /// The event the edit is for, as `POST /api/v1/webhooks/rules/match` named it; left out,
    /// every event this action sends to the endpoint.
    pub event_type: Option<String>,
    /// The body, sent exactly as written and signed over these bytes with the endpoint's secret.
    pub body: String,
    /// Headers to set or change, by name; the others are sent as rendered.
    pub headers: Option<BTreeMap<String, String>>,
}

/// The webhook choice every simulating operation takes (WH-13.5, WH-14.4).
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct WebhookChoiceInput {
    /// Send this action's webhooks to exactly these endpoints (IDs from
    /// `GET /api/v1/webhooks/endpoints`) instead of the ones the rules pick; an empty list
    /// sends none. Leave it out to let the rules decide.
    pub webhook_endpoint_ids: Option<Vec<String>>,
    /// Payloads edited for this action, by endpoint: each body is sent as written instead of
    /// the rendered one. Leave it out to send the rendered payloads.
    pub webhook_requests: Option<Vec<WebhookRequestEdit>>,
}

impl WebhookChoiceInput {
    /// The context for this one action: its events go to the chosen endpoints, with the edited
    /// payloads. Each endpoint must exist and be enabled, and an edited one must be chosen when
    /// endpoints are, or the action answers `422` naming it.
    pub async fn apply_to(
        &self,
        operation_context: &OperationContext,
    ) -> Result<OperationContext, OperationError> {
        let mut action_context = operation_context.clone();
        if self.webhook_endpoint_ids.is_none() && self.webhook_requests.is_none() {
            return Ok(action_context);
        }
        let endpoint_ids = match &self.webhook_endpoint_ids {
            Some(endpoint_ids) => {
                Some(read_chosen_endpoint_ids(operation_context, endpoint_ids).await?)
            }
            None => None,
        };
        let mut edited_requests = Vec::new();
        for request_edit in self.webhook_requests.iter().flatten() {
            check_endpoint_can_be_chosen(operation_context, &request_edit.endpoint_id).await?;
            check_edit_is_chosen(endpoint_ids.as_deref(), &request_edit.endpoint_id)?;
            edited_requests.push(to_edited_request(request_edit));
        }
        action_context.request.webhook_choice = Some(WebhookChoice {
            endpoint_ids,
            edited_requests,
        });
        Ok(action_context)
    }
}

async fn read_chosen_endpoint_ids(
    operation_context: &OperationContext,
    endpoint_ids: &[String],
) -> Result<Vec<String>, OperationError> {
    let mut chosen_endpoint_ids: Vec<String> = Vec::with_capacity(endpoint_ids.len());
    for endpoint_id in endpoint_ids {
        check_endpoint_can_be_chosen(operation_context, endpoint_id).await?;
        if !chosen_endpoint_ids.contains(endpoint_id) {
            chosen_endpoint_ids.push(endpoint_id.clone());
        }
    }
    Ok(chosen_endpoint_ids)
}

fn check_edit_is_chosen(
    chosen_endpoint_ids: Option<&[String]>,
    endpoint_id: &str,
) -> Result<(), OperationError> {
    match chosen_endpoint_ids {
        Some(chosen_endpoint_ids)
            if !chosen_endpoint_ids
                .iter()
                .any(|chosen_id| chosen_id == endpoint_id) =>
        {
            Err(refuse_endpoint(format!(
                "The webhook endpoint {endpoint_id} has an edited request but is not in webhook_endpoint_ids"
            )))
        }
        _ => Ok(()),
    }
}

/// Header names are sent in lowercase; the Standard Webhooks headers are made by the sender
/// for each attempt, so an edit cannot set them.
fn to_edited_request(request_edit: &WebhookRequestEdit) -> EditedWebhookRequest {
    let headers = request_edit
        .headers
        .iter()
        .flatten()
        .filter(|(header_name, _)| !is_signature_header(header_name))
        .map(|(header_name, header_value)| (header_name.to_ascii_lowercase(), header_value.clone()))
        .collect();
    EditedWebhookRequest {
        endpoint_id: request_edit.endpoint_id.clone(),
        event_type: request_edit.event_type.clone(),
        body: request_edit.body.clone(),
        headers,
    }
}

fn refuse_endpoint(message: String) -> OperationError {
    OperationError::Unprocessable {
        code: "webhook_endpoint_unavailable",
        message,
    }
}

pub(super) async fn check_endpoint_can_be_chosen(
    operation_context: &OperationContext,
    endpoint_id: &str,
) -> Result<(), OperationError> {
    match operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?
    {
        None => Err(refuse_endpoint(format!(
            "No webhook endpoint has the ID {endpoint_id}"
        ))),
        Some(stored_endpoint) if !stored_endpoint.is_enabled => Err(refuse_endpoint(format!(
            "The webhook endpoint {} ({endpoint_id}) is disabled",
            stored_endpoint.name
        ))),
        Some(_) => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use crate::build_operation_registry;

    /// Every operation behind a UI action that simulates traffic (WH-13.2).
    const SIMULATING_OPERATION_IDS: [&str; 11] = [
        "postEmailsByEmailIdSimulate",
        "postEmailsByEmailIdOpen",
        "postEmailsByEmailIdClicks",
        "postEmailsByEmailIdReply",
        "postEmailsByEmailIdForward",
        "postEmailsInbound",
        "postSamplesByKind",
        "postSmsBySmsIdStatus",
        "postSmsBySmsIdOpen",
        "postSmsInbound",
        "postPaymentsByPaymentIdSimulate",
    ];

    // AC: WH-14.4
    #[test]
    fn every_simulating_operation_takes_edited_webhook_requests() {
        let operation_registry = build_operation_registry();
        for operation_id in SIMULATING_OPERATION_IDS {
            let Some(operation) = operation_registry.find_by_operation_id(operation_id) else {
                panic!("{operation_id} is not registered");
            };
            let input_schema = operation.input_schema().to_value();
            assert!(
                input_schema["properties"]["webhook_requests"].is_object(),
                "{operation_id} takes no webhook_requests"
            );
        }
    }

    // AC: WH-13.5
    #[test]
    fn every_simulating_operation_takes_a_webhook_choice_with_a_webhook_flag() {
        let operation_registry = build_operation_registry();
        for operation_id in SIMULATING_OPERATION_IDS {
            let Some(operation) = operation_registry.find_by_operation_id(operation_id) else {
                panic!("{operation_id} is not registered");
            };
            let input_schema = operation.input_schema().to_value();
            assert!(
                input_schema["properties"]["webhook_endpoint_ids"].is_object(),
                "{operation_id} takes no webhook_endpoint_ids"
            );
            assert!(
                operation
                    .definition()
                    .cli_flag_names
                    .contains(&("webhook_endpoint_ids", "webhook")),
                "{operation_id} has no --webhook flag"
            );
        }
    }
}
