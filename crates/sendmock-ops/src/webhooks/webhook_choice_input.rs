use schemars::JsonSchema;
use serde::Deserialize;

use crate::{OperationContext, OperationError, WebhookChoice};

/// The webhook choice every simulating operation takes (WH-13.5).
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct WebhookChoiceInput {
    /// Send this action's webhooks to exactly these endpoints (IDs from
    /// `GET /api/v1/webhooks/endpoints`) instead of the ones the rules pick; an empty list
    /// sends none. Leave it out to let the rules decide.
    pub webhook_endpoint_ids: Option<Vec<String>>,
}

impl WebhookChoiceInput {
    /// The context for this one action: its events go to the chosen endpoints. Each must
    /// exist and be enabled, or the action answers `422` naming it.
    pub async fn apply_to(
        &self,
        operation_context: &OperationContext,
    ) -> Result<OperationContext, OperationError> {
        let mut action_context = operation_context.clone();
        let Some(endpoint_ids) = &self.webhook_endpoint_ids else {
            return Ok(action_context);
        };
        let mut chosen_endpoint_ids: Vec<String> = Vec::with_capacity(endpoint_ids.len());
        for endpoint_id in endpoint_ids {
            check_endpoint_can_be_chosen(operation_context, endpoint_id).await?;
            if !chosen_endpoint_ids.contains(endpoint_id) {
                chosen_endpoint_ids.push(endpoint_id.clone());
            }
        }
        action_context.request.webhook_choice = Some(WebhookChoice {
            endpoint_ids: chosen_endpoint_ids,
        });
        Ok(action_context)
    }
}

fn refuse_endpoint(message: String) -> OperationError {
    OperationError::Unprocessable {
        code: "webhook_endpoint_unavailable",
        message,
    }
}

async fn check_endpoint_can_be_chosen(
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
