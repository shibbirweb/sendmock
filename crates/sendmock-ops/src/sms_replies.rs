mod reply_webhook_failure;
mod reply_webhook_request;
mod reply_webhook_resend_operation;
mod reply_webhook_run;
mod reply_webhook_target;
mod twiml_fetch;
mod twiml_reply;

use crate::OperationRegistry;

pub use reply_webhook_request::TWILIO_INBOUND_TEMPLATE_ID;
pub use reply_webhook_resend_operation::ResendSmsReplyWebhookOperation;
pub use reply_webhook_run::{MAXIMUM_TWIML_FETCHES, run_reply_webhook, start_reply_webhook};
pub use reply_webhook_target::{
    ReplyWebhookTarget, ReplyWebhookTargetKind, resolve_reply_webhook_target,
};

pub fn register_sms_reply_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ResendSmsReplyWebhookOperation);
}
