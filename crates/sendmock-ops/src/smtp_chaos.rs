//! Settings > Chaos for the SMTP listener: refused recipients, slow replies, dropped
//! connections and a run of refused messages (EM-15).

use sendmock_core::matches_wildcard_pattern;

use crate::{OperationContext, OperationError};

/// What the chaos settings ask of one SMTP session step.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SmtpChaos {
    pub command_latency_ms: u32,
    pub rejected_recipient_pattern: Option<String>,
    pub is_drop_during_data_enabled: bool,
}

impl SmtpChaos {
    /// Whether the recipient matches the refused pattern (a glob that ignores case).
    pub fn is_rejected_recipient(&self, recipient_address: &str) -> bool {
        self.rejected_recipient_pattern
            .as_deref()
            .is_some_and(|recipient_pattern| {
                matches_wildcard_pattern(
                    &recipient_pattern.to_lowercase(),
                    &recipient_address.to_lowercase(),
                )
            })
    }
}

/// The chaos settings as they are now.
pub async fn read_smtp_chaos(
    operation_context: &OperationContext,
) -> Result<SmtpChaos, OperationError> {
    let app_settings = operation_context.settings_store.current().await?;
    Ok(SmtpChaos {
        command_latency_ms: app_settings.chaos_smtp_command_latency_ms,
        rejected_recipient_pattern: app_settings
            .chaos_smtp_reject_recipient_pattern
            .filter(|recipient_pattern| !recipient_pattern.trim().is_empty()),
        is_drop_during_data_enabled: app_settings.is_chaos_smtp_drop_during_data_enabled,
    })
}

/// The code to refuse this message with while "Reject next N" still counts; each refusal
/// counts the setting down by one, so exactly N messages are refused (EM-15.1).
pub async fn take_chaos_rejection(
    operation_context: &OperationContext,
) -> Result<Option<u16>, OperationError> {
    let settings_store = &operation_context.settings_store;
    let app_settings = settings_store.current().await?;
    if app_settings.chaos_smtp_reject_next_count == 0 {
        return Ok(None);
    }
    let reject_code = app_settings.chaos_smtp_reject_code;
    let counted_down = crate::AppSettings {
        chaos_smtp_reject_next_count: app_settings.chaos_smtp_reject_next_count - 1,
        ..app_settings
    };
    settings_store
        .save(counted_down, operation_context.clock.now_unix_ms())
        .await?;
    Ok(Some(reject_code))
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-15.2
    #[test]
    fn the_recipient_pattern_is_a_glob_that_ignores_case() {
        let smtp_chaos = SmtpChaos {
            rejected_recipient_pattern: Some("*@Bounce.test".to_owned()),
            ..SmtpChaos::default()
        };

        assert!(smtp_chaos.is_rejected_recipient("sam@bounce.TEST"));
        assert!(!smtp_chaos.is_rejected_recipient("sam@example.test"));
        assert!(!SmtpChaos::default().is_rejected_recipient("sam@bounce.test"));
    }
}
