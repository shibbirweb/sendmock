use sendmock_ops::{OperationContext, run_webhook_dispatcher, run_webhook_rule_subscriber};
use tokio::sync::watch;

/// At most this many webhook requests are in flight at once (WH-03.6).
const MAX_CONCURRENT_DELIVERIES: u32 = 8;

/// Runs the webhook rules and the dispatcher until shutdown. An attempt cut off by shutdown
/// stays `in_flight` and is queued again on the next start.
pub async fn run_webhook_dispatch_task(
    operation_context: OperationContext,
    mut shutdown_receiver: watch::Receiver<bool>,
) {
    tokio::select! {
        () = run_webhook_rule_subscriber(operation_context.clone()) => {}
        () = run_webhook_dispatcher(operation_context, MAX_CONCURRENT_DELIVERIES) => {}
        _ = shutdown_receiver.changed() => {}
    }
}
