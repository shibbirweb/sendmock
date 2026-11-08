mod http_call_result;
mod media_fetcher;
mod message_sid;
mod reply_webhook_sender;
mod sms_change_operations;
mod sms_delivery_runner;
mod sms_detail;
mod sms_ingest;
mod sms_inputs;
mod sms_lookups;
mod sms_media_intake;
mod sms_open_operations;
mod sms_read_operations;
mod sms_reply_webhook_views;
mod sms_send_decision;
mod sms_send_operations;
mod sms_views;
mod status_callback;
mod status_callback_attempt;
mod status_callback_dispatch;
mod status_callback_sender;

pub use http_call_result::HttpCallResult;
pub use media_fetcher::{FetchedMedia, MediaFetcher};
pub use message_sid::generate_message_sid;
pub use reply_webhook_sender::ReplyWebhookSender;
pub use sms_change_operations::{
    DeleteAllSmsOperation, DeleteSmsOperation, SetSmsStatusOperation, apply_status_change,
};
pub use sms_delivery_runner::start_sms_delivery;
pub use sms_detail::SmsMessageDetail;
pub(crate) use sms_detail::{find_sms_or_not_found, load_sms_detail};
pub use sms_ingest::{IncomingSms, store_sms};
pub(crate) use sms_inputs::{InlineSmsMedia, SmsReference};
pub use sms_lookups::{describe_sms_code, find_newest_sms_with_code};
pub use sms_media_intake::{AcceptedMedia, MediaProblem, accept_media};
pub use sms_open_operations::{ListSmsOpensOperation, RecordSmsOpenOperation};
pub use sms_read_operations::{
    DownloadSmsMediaOperation, GetSmsOperation, ListSmsOperation, ListSmsThreadsOperation,
    WaitForSmsOperation,
};
pub use sms_reply_webhook_views::{
    ReplyWebhookOutcome, ReplyWebhookTargetName, SmsReplyWebhookAttempt, SmsReplyWebhookResult,
    TwimlMethodName, TwimlVerbView,
};
pub use sms_send_decision::{
    decide_outbound_send, describe_rejection, load_custom_outcome_rules, to_simulation_profile,
};
pub use sms_send_operations::{SendSmsOperation, SimulateInboundSmsOperation};
pub use sms_views::{RecordedHttpRequest, RecordedHttpResponse, SmsMessage, SmsThread};
pub use status_callback_dispatch::{run_due_status_callbacks, run_status_callback_dispatcher};
pub use status_callback_sender::StatusCallbackSender;

use crate::OperationRegistry;

/// Every SMS operation this build serves.
pub fn register_sms_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmsOperation);
    operation_registry.register(DeleteAllSmsOperation);
    operation_registry.register(SendSmsOperation);
    operation_registry.register(ListSmsThreadsOperation);
    operation_registry.register(GetSmsOperation);
    operation_registry.register(DeleteSmsOperation);
    operation_registry.register(DownloadSmsMediaOperation);
    operation_registry.register(SetSmsStatusOperation);
    operation_registry.register(RecordSmsOpenOperation);
    operation_registry.register(ListSmsOpensOperation);
    operation_registry.register(SimulateInboundSmsOperation);
    operation_registry.register(WaitForSmsOperation);
}
