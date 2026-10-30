use schemars::JsonSchema;
use sendmock_mail::{BounceType, EmailDeliveryEvent};
use serde::Deserialize;

use super::delivery_event_recording::record_delivery_event;
use super::email_access::find_email_or_not_found;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SimulatedDeliveryEvent {
    Delivered,
    Deferred,
    Bounced,
    Complained,
    Unsubscribed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SimulatedBounceType {
    Hard,
    Soft,
}

/// Body of `POST /api/v1/emails/{emailId}/simulate`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SimulatedEmailOutcome {
    pub email_id: String,
    /// The delivery event to simulate; it is added to the timeline and fires its webhook.
    pub event: SimulatedDeliveryEvent,
    /// For `bounced` only: hard (the default) or soft.
    pub bounce_type: Option<SimulatedBounceType>,
}

impl SimulatedEmailOutcome {
    fn to_delivery_event(&self) -> EmailDeliveryEvent {
        match self.event {
            SimulatedDeliveryEvent::Delivered => EmailDeliveryEvent::Delivered,
            SimulatedDeliveryEvent::Deferred => EmailDeliveryEvent::Deferred,
            SimulatedDeliveryEvent::Bounced => {
                EmailDeliveryEvent::bounce_of_type(match self.bounce_type {
                    Some(SimulatedBounceType::Soft) => BounceType::Soft,
                    Some(SimulatedBounceType::Hard) | None => BounceType::Hard,
                })
            }
            SimulatedDeliveryEvent::Complained => EmailDeliveryEvent::Complained,
            SimulatedDeliveryEvent::Unsubscribed => EmailDeliveryEvent::Unsubscribed,
        }
    }
}

pub struct SimulateEmailOutcomeOperation;

impl Operation for SimulateEmailOutcomeOperation {
    type Input = SimulatedEmailOutcome;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdSimulate",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/simulate",
            summary: "Simulate a delivery outcome such as a bounce or complaint.",
            cli_usage: "sendmock email simulate <emailId> <event>",
            mcp_tool: "sendmock_email_simulate",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Fires the chosen event at once, whatever the profile or magic addresses say (EM-10.3).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SimulatedEmailOutcome,
    ) -> Result<NoContent, OperationError> {
        let stored_email = find_email_or_not_found(operation_context, &input.email_id).await?;
        let recipient_address = stored_email
            .to
            .first()
            .map(|recipient| recipient.address.clone())
            .unwrap_or_default();
        let delivery_event = input.to_delivery_event();
        let timeline_detail = format!(
            "{recipient_address}: {} (simulated)",
            delivery_event.describe()
        );
        record_delivery_event(
            operation_context,
            &stored_email.email_id,
            &delivery_event,
            &recipient_address,
            timeline_detail,
        )
        .await?;
        Ok(NoContent)
    }
}
