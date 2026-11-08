use sendmock_ops::{
    OperationContext, run_status_callback_dispatcher, run_webhook_dispatcher,
    run_webhook_rule_subscriber,
};
use tokio::sync::watch;

/// At most this many webhook requests are in flight at once (WH-03.6).
const MAX_CONCURRENT_DELIVERIES: u32 = 8;

/// At most this many status callback retries are in flight at once.
const MAX_CONCURRENT_CALLBACK_RETRIES: u32 = 8;

/// Runs the webhook rules, the webhook dispatcher and the status callback retries until
/// shutdown. An attempt cut off by shutdown stays `in_flight` and is queued again on the next
/// start.
pub async fn run_webhook_dispatch_task(
    operation_context: OperationContext,
    mut shutdown_receiver: watch::Receiver<bool>,
) {
    tokio::select! {
        () = run_webhook_rule_subscriber(operation_context.clone()) => {}
        () = run_webhook_dispatcher(operation_context.clone(), MAX_CONCURRENT_DELIVERIES) => {}
        () = run_status_callback_dispatcher(operation_context, MAX_CONCURRENT_CALLBACK_RETRIES) => {}
        _ = shutdown_receiver.changed() => {}
    }
}
