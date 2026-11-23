use super::app_settings::AppSettings;
use super::reset_summary::{
    ResetItemCount, ResetRequest, ResetSummary, count_by_kind, describe_counts, keep_nonzero_counts,
};
use crate::seed::export_seed_items;
use crate::setup::{SetupImportMode, preview_setup_changes};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    publish_email_deleted, remove_all_configuration, restore_seed_state,
};

pub struct ResetOperation;

impl Operation for ResetOperation {
    type Input = ResetRequest;
    type Output = ResetSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postReset",
            method: HttpMethod::Post,
            path: "/api/v1/reset",
            summary: "Delete all traffic and apply the seed applied last again, keeping the rest of the configuration; with config, also remove every configured item and restore the built-in providers. Answers what it cleared, removed and kept.",
            is_destructive: true,
            cli_usage: "sendmock reset --yes",
            mcp_tool: "sendmock_reset",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deletes all traffic and puts the settings back to their defaults. Then either restores
    /// the seed applied last (its items as the file has them, the configuration it does not
    /// hold deleted; without a seed, numbers, services, rules and the rest stay), or with
    /// `config`, once the count is confirmed, removes every configured item.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ResetRequest,
    ) -> Result<ResetSummary, OperationError> {
        let removed = match input.config {
            true => {
                confirm_configuration_removal(operation_context, input.confirm_removed_count)
                    .await?
            }
            false => Vec::new(),
        };
        let cleared = delete_all_traffic(operation_context).await?;
        let restored_seed = match input.config {
            true => {
                remove_all_configuration(operation_context).await?;
                false
            }
            false => {
                operation_context
                    .settings_store
                    .save(
                        AppSettings::default(),
                        operation_context.clock.now_unix_ms(),
                    )
                    .await?;
                restore_seed_state(operation_context).await?
            }
        };
        let kept = count_by_kind(
            export_seed_items(operation_context)
                .await?
                .into_iter()
                .map(|seed_item| seed_item.item_kind),
        );
        Ok(ResetSummary {
            cleared,
            removed,
            kept,
            restored_seed,
        })
    }
}

/// What a configuration reset removes, by kind; refused until `confirm_removed_count` matches,
/// with each kind and its count named.
async fn confirm_configuration_removal(
    operation_context: &OperationContext,
    confirm_removed_count: Option<usize>,
) -> Result<Vec<ResetItemCount>, OperationError> {
    let removal_preview = preview_setup_changes(
        operation_context,
        &toml::Table::new(),
        SetupImportMode::Replace,
    )
    .await?;
    let removed = count_by_kind(removal_preview.iter().flat_map(|section_change| {
        section_change
            .removed
            .iter()
            .map(|_| section_change.item_kind.clone())
    }));
    let removed_count: usize = removal_preview
        .iter()
        .map(|section_change| section_change.removed.len())
        .sum();
    if removed_count > 0 && confirm_removed_count != Some(removed_count) {
        return Err(OperationError::Unprocessable {
            code: "reset_config_unconfirmed",
            message: format!(
                "This reset also removes {removed_count} configured items ({}) and restores the built-in providers. Send confirm_removed_count = {removed_count} (--confirm-removed-count {removed_count}) to go ahead",
                describe_counts(&removed)
            ),
        });
    }
    Ok(removed)
}

/// Every email, SMS, verification, push notification, SMTP session, logged request, webhook
/// delivery and payment; answers how many of each went, and tells listeners the emails did.
async fn delete_all_traffic(
    operation_context: &OperationContext,
) -> Result<Vec<ResetItemCount>, OperationError> {
    let email_count = operation_context
        .email_repository
        .delete_all_emails()
        .await?;
    let sms_count = operation_context
        .sms_repository
        .delete_all_messages(None)
        .await?;
    let verification_count = operation_context
        .verification_repository
        .delete_all_verifications()
        .await?;
    let push_count = operation_context
        .push_notifications
        .delete_notifications(None)
        .await?;
    let opt_out_count = operation_context
        .sms_delivery_stores
        .opt_outs
        .delete_all_opt_outs()
        .await?;
    operation_context
        .sms_repository
        .whatsapp_media()
        .delete_all_media()
        .await?;
    if email_count > 0 {
        publish_email_deleted(operation_context, None, email_count);
    }
    let mut cleared = keep_nonzero_counts(&[
        ("emails", email_count),
        ("SMS messages", sms_count),
        ("verifications", verification_count),
        ("push notifications", push_count),
        ("SMS opt-outs", opt_out_count),
    ]);
    cleared.extend(delete_logs_deliveries_and_payments(operation_context).await?);
    Ok(cleared)
}

/// The SMTP sessions, API requests, webhook deliveries, payments and subscriptions, counted.
async fn delete_logs_deliveries_and_payments(
    operation_context: &OperationContext,
) -> Result<Vec<ResetItemCount>, OperationError> {
    let session_count = operation_context
        .logs
        .smtp_sessions
        .delete_all_sessions()
        .await?;
    let request_count = operation_context
        .logs
        .api_requests
        .delete_all_requests()
        .await?;
    let delivery_count = operation_context
        .webhook_delivery_repository
        .delete_all_deliveries()
        .await?;
    let payment_count = operation_context
        .payment_repository
        .delete_all_payments()
        .await?;
    let subscription_count = operation_context
        .payment_stores
        .subscriptions
        .delete_all_subscriptions()
        .await?;
    Ok(keep_nonzero_counts(&[
        ("SMTP sessions", session_count),
        ("API requests", request_count),
        ("webhook deliveries", delivery_count),
        ("payments", payment_count),
        ("subscriptions", subscription_count),
    ]))
}
