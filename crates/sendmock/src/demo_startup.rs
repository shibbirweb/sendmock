use sendmock_ops::{DemoLoadOutcome, OperationContext, load_demo_data};

/// `--demo`: the sample data for an empty instance; a failure is logged and startup goes on,
/// since the instance works without it.
pub async fn load_demo_data_at_startup(operation_context: &OperationContext) {
    match load_demo_data(operation_context).await {
        Ok(DemoLoadOutcome::Loaded { step_count }) => {
            tracing::info!(step_count, "Loaded the demo data");
        }
        Ok(DemoLoadOutcome::SkippedBecauseNotEmpty) => {
            tracing::info!("Skipped the demo data: this instance already holds data");
        }
        Err(demo_error) => {
            tracing::warn!(error = %demo_error, "The demo data could not be loaded");
        }
    }
}
