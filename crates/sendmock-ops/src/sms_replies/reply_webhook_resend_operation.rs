use serde_json::Value;

use super::reply_webhook_run::run_reply_webhook;
use crate::sms::{SmsMessageDetail, SmsReference, find_sms_or_not_found, load_sms_detail};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// `POST /api/v1/sms/{smsId}/reply-webhook/resend`: sends an inbound message's reply webhook
/// again after you fixed the handler, as Twilio never retries it.
pub struct ResendSmsReplyWebhookOperation;

impl Operation for ResendSmsReplyWebhookOperation {
    type Input = SmsReference;
    type Output = SmsMessageDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSmsBySmsIdReplyWebhookResend",
            method: HttpMethod::Post,
            path: "/api/v1/sms/{smsId}/reply-webhook/resend",
            summary: "Send an inbound message's reply webhook again.",
            cli_usage: "sendmock sms resend-reply-webhook <smsId>",
            mcp_tool: "sendmock_sms_reply_webhook_resend",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Runs in the request, so the answer holds the new attempts and replies, with the format
    /// the message was simulated with.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsReference,
    ) -> Result<SmsMessageDetail, OperationError> {
        let inbound_sms = find_sms_or_not_found(operation_context, &input.sms_id).await?;
        if inbound_sms.direction != "inbound" {
            return Err(OperationError::Conflict {
                code: "outbound_sms",
                message: "Only inbound messages have a reply webhook".to_owned(),
            });
        }
        let template_override =
            read_simulated_template_id(inbound_sms.request_body_json.as_deref());
        let reply_webhook_result = run_reply_webhook(
            operation_context,
            &inbound_sms,
            template_override.as_deref(),
        )
        .await?;
        if reply_webhook_result.is_none() {
            return Err(OperationError::Conflict {
                code: "no_reply_webhook",
                message: "This number has no reply webhook; set an inbound URL in Numbers"
                    .to_owned(),
            });
        }
        let updated_sms = find_sms_or_not_found(operation_context, &input.sms_id).await?;
        load_sms_detail(operation_context, updated_sms).await
    }
}

/// The format picked when the message was simulated, kept in its request body.
fn read_simulated_template_id(request_body_json: Option<&str>) -> Option<String> {
    let request_body: Value = serde_json::from_str(request_body_json?).ok()?;
    request_body["template_id"].as_str().map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_format_the_message_was_simulated_with() {
        assert_eq!(
            read_simulated_template_id(Some(r#"{"template_id":"vonage.inbound_sms"}"#)),
            Some("vonage.inbound_sms".to_owned())
        );
        assert_eq!(
            read_simulated_template_id(Some(r#"{"template_id":null}"#)),
            None
        );
        assert_eq!(read_simulated_template_id(Some("not json")), None);
        assert_eq!(read_simulated_template_id(None), None);
    }
}
