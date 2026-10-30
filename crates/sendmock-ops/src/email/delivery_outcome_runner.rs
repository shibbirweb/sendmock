use std::time::Duration;

use sendmock_mail::{
    DeliveryProfile, OutcomeAction, OutcomeSettings, OutcomeStep, PlannedOutcome,
    plan_email_outcome,
};
use sendmock_store::EmailRecord;

use super::delivery_event_recording::record_delivery_event;
use super::out_of_office_reply::send_out_of_office_reply;
use crate::{
    AppSettings, EmailOutcomeProfile, OperationContext, OperationError, publish_email_received,
};

fn read_outcome_settings(app_settings: &AppSettings) -> OutcomeSettings {
    OutcomeSettings {
        is_magic_addresses_enabled: app_settings.is_magic_addresses_enabled,
        delivery_profile: match app_settings.email_outcome_profile {
            EmailOutcomeProfile::Off => DeliveryProfile::Off,
            EmailOutcomeProfile::AutoDelivered => DeliveryProfile::AutoDelivered,
            EmailOutcomeProfile::Realistic => DeliveryProfile::Realistic {
                bounce_rate_percent: app_settings.email_outcome_bounce_rate_percent,
                complaint_rate_percent: app_settings.email_outcome_complaint_rate_percent,
            },
        },
    }
}

/// Announces a stored email and, for mail your app sent, starts the delivery outcome its
/// recipients or the delivery profile ask for. Every path that stores an email ends here.
pub async fn complete_email_intake(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<(), OperationError> {
    publish_email_received(operation_context, stored_email);
    if stored_email.direction != "outbound" {
        return Ok(());
    }
    let recipient_addresses: Vec<String> = stored_email
        .to
        .iter()
        .chain(&stored_email.cc)
        .chain(&stored_email.bcc)
        .map(|recipient| recipient.address.clone())
        .collect();
    let outcome_settings =
        read_outcome_settings(&operation_context.settings_store.current().await?);
    let Some(planned_outcome) = plan_email_outcome(
        &recipient_addresses,
        outcome_settings,
        operation_context.random_source.as_ref(),
    ) else {
        return Ok(());
    };
    play_outcome(operation_context, stored_email, planned_outcome).await
}

/// Plays the steps due now before answering, so a send to `bounce@` is already bounced when
/// the send returns; later steps play in one background task per email.
async fn play_outcome(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
    mut planned_outcome: PlannedOutcome,
) -> Result<(), OperationError> {
    let (due_steps, later_steps): (Vec<OutcomeStep>, Vec<OutcomeStep>) =
        std::mem::take(&mut planned_outcome.steps)
            .into_iter()
            .partition(|outcome_step| outcome_step.after_ms == 0);
    for due_step in due_steps {
        play_outcome_step(operation_context, stored_email, &planned_outcome, due_step).await?;
    }
    if later_steps.is_empty() {
        return Ok(());
    }
    let background_context = operation_context.clone();
    let original_email = stored_email.clone();
    tokio::spawn(async move {
        let started_at = tokio::time::Instant::now();
        for later_step in later_steps {
            tokio::time::sleep_until(started_at + Duration::from_millis(later_step.after_ms)).await;
            let email_id = original_email.email_id.clone();
            if let Err(outcome_error) = play_outcome_step(
                &background_context,
                &original_email,
                &planned_outcome,
                later_step,
            )
            .await
            {
                tracing::warn!(email_id, error = %outcome_error, "email delivery outcome stopped");
                return;
            }
        }
    });
    Ok(())
}

async fn play_outcome_step(
    operation_context: &OperationContext,
    original_email: &EmailRecord,
    planned_outcome: &PlannedOutcome,
    outcome_step: OutcomeStep,
) -> Result<(), OperationError> {
    let recipient_address = &planned_outcome.recipient_address;
    match outcome_step.action {
        OutcomeAction::Report(delivery_event) => {
            let timeline_detail = format!(
                "{recipient_address}: {} ({})",
                delivery_event.describe(),
                planned_outcome.source.label()
            );
            record_delivery_event(
                operation_context,
                &original_email.email_id,
                &delivery_event,
                recipient_address,
                timeline_detail,
            )
            .await?;
        }
        OutcomeAction::ReplyOutOfOffice => {
            send_out_of_office_reply(operation_context, original_email, recipient_address).await?;
        }
    }
    Ok(())
}
