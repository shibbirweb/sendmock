use sendmock_mail::OtpExtractor;

use super::app_settings_update::AppSettingsUpdate;
use super::setting_choices::CHAOS_SMTP_REJECT_CODES;
use crate::OperationError;

/// The same rules as the Settings forms (PL-05.2); only keys in the update are checked, and
/// the first problem is answered with its field.
pub fn validate_settings_update(update: &AppSettingsUpdate) -> Result<(), OperationError> {
    validate_limits(update)?;
    validate_chaos_settings(update)?;
    validate_addresses(update)?;
    validate_otp_patterns(update.otp_patterns.as_deref())?;
    validate_payment_settings(update)
}

fn validate_limits(update: &AppSettingsUpdate) -> Result<(), OperationError> {
    check_range(
        "max_emails",
        update.max_emails,
        1,
        1_000_000,
        "Choose 1 to 1,000,000",
    )?;
    check_range(
        "max_sms",
        update.max_sms,
        1,
        1_000_000,
        "Choose 1 to 1,000,000",
    )?;
    check_range(
        "max_age_days",
        update.max_age_days.flatten().map(u64::from),
        1,
        3650,
        "Choose 1 to 3,650 days",
    )?;
    for (field_name, percent) in [
        (
            "email_outcome_bounce_rate_percent",
            update.email_outcome_bounce_rate_percent,
        ),
        (
            "email_outcome_complaint_rate_percent",
            update.email_outcome_complaint_rate_percent,
        ),
        ("sms_failure_rate_percent", update.sms_failure_rate_percent),
        (
            "payment_random_success_rate_percent",
            update.payment_random_success_rate_percent,
        ),
    ] {
        check_range(
            field_name,
            percent.map(u64::from),
            0,
            100,
            "Choose 0 to 100%",
        )?;
    }
    Ok(())
}

fn validate_chaos_settings(update: &AppSettingsUpdate) -> Result<(), OperationError> {
    check_range(
        "chaos_smtp_reject_next_count",
        update.chaos_smtp_reject_next_count.map(u64::from),
        0,
        1000,
        "Choose 0 to 1,000 messages",
    )?;
    check_range(
        "chaos_smtp_command_latency_ms",
        update.chaos_smtp_command_latency_ms.map(u64::from),
        0,
        60_000,
        "Choose 0 to 60,000 ms",
    )?;
    if update
        .chaos_smtp_reject_code
        .is_some_and(|reject_code| !CHAOS_SMTP_REJECT_CODES.contains(&reject_code))
    {
        return Err(field_error(
            "chaos_smtp_reject_code",
            "Choose 421, 450, 550 or 552",
        ));
    }
    Ok(())
}

fn validate_addresses(update: &AppSettingsUpdate) -> Result<(), OperationError> {
    if let Some(Some(relay_url)) = &update.relay_smtp_url
        && !(relay_url.starts_with("smtp://") || relay_url.starts_with("smtps://"))
    {
        return Err(field_error(
            "relay_smtp_url",
            "Use smtp://user:password@host:port or smtps://...",
        ));
    }
    if update
        .relay_recipient_allowlist
        .as_ref()
        .is_some_and(|patterns| {
            patterns
                .iter()
                .any(|pattern| pattern.trim().is_empty() || pattern.contains(char::is_whitespace))
        })
    {
        return Err(field_error(
            "relay_recipient_allowlist",
            "Patterns cannot be empty or contain spaces",
        ));
    }
    if let Some(Some(spamd_address)) = &update.spamassassin_address
        && !is_host_and_port(spamd_address)
    {
        return Err(field_error(
            "spamassassin_address",
            "Use host:port, for example 127.0.0.1:783",
        ));
    }
    Ok(())
}

fn validate_otp_patterns(otp_patterns: Option<&[String]>) -> Result<(), OperationError> {
    for (pattern_index, otp_pattern) in otp_patterns.unwrap_or_default().iter().enumerate() {
        let pattern_number = pattern_index + 1;
        if OtpExtractor::with_patterns(&[otp_pattern.as_str()]).is_err() {
            return Err(field_error(
                "otp_patterns",
                &format!("Pattern {pattern_number} is not a valid regular expression"),
            ));
        }
        if !has_capture_group(otp_pattern) {
            return Err(field_error(
                "otp_patterns",
                &format!("Pattern {pattern_number} needs a capture group around the code"),
            ));
        }
    }
    Ok(())
}

fn validate_payment_settings(update: &AppSettingsUpdate) -> Result<(), OperationError> {
    if update
        .payment_merchant_name
        .as_ref()
        .is_some_and(|merchant_name| {
            merchant_name.trim().is_empty() || merchant_name.chars().count() > 60
        })
    {
        return Err(field_error(
            "payment_merchant_name",
            "Use 1 to 60 characters",
        ));
    }
    if update
        .payment_default_currency
        .as_ref()
        .is_some_and(|currency| {
            currency.len() != 3 || !currency.chars().all(|letter| letter.is_ascii_uppercase())
        })
    {
        return Err(field_error(
            "payment_default_currency",
            "Use a 3-letter currency code, e.g. USD",
        ));
    }
    Ok(())
}

/// A group that captures: `(` not followed by `?`, or a named group.
fn has_capture_group(otp_pattern: &str) -> bool {
    otp_pattern.match_indices('(').any(|(position, _)| {
        let after_paren = &otp_pattern[position + 1..];
        !after_paren.starts_with('?')
            || after_paren.starts_with("?P<")
            || after_paren.starts_with("?<")
    })
}

fn is_host_and_port(address: &str) -> bool {
    let Some((host, port_text)) = address.rsplit_once(':') else {
        return false;
    };
    let is_host_valid = !host.is_empty()
        && host.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
        });
    is_host_valid && port_text.parse::<u16>().is_ok_and(|port| port >= 1)
}

fn check_range(
    field_name: &str,
    value: Option<u64>,
    minimum: u64,
    maximum: u64,
    message: &str,
) -> Result<(), OperationError> {
    match value {
        Some(value) if !(minimum..=maximum).contains(&value) => {
            Err(field_error(field_name, message))
        }
        _ => Ok(()),
    }
}

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field_of(update: &AppSettingsUpdate) -> Option<String> {
        match validate_settings_update(update) {
            Err(OperationError::InvalidInput { field, .. }) => field,
            _ => None,
        }
    }

    fn assert_field_error(update: AppSettingsUpdate, expected_field: &str) {
        assert_eq!(field_of(&update).as_deref(), Some(expected_field));
    }

    // AC: PL-05.2
    #[test]
    fn numbers_out_of_range_name_their_field() {
        assert_field_error(
            AppSettingsUpdate {
                max_emails: Some(0),
                ..AppSettingsUpdate::default()
            },
            "max_emails",
        );
        assert_field_error(
            AppSettingsUpdate {
                max_age_days: Some(Some(4000)),
                ..AppSettingsUpdate::default()
            },
            "max_age_days",
        );
        assert_field_error(
            AppSettingsUpdate {
                sms_failure_rate_percent: Some(101),
                ..AppSettingsUpdate::default()
            },
            "sms_failure_rate_percent",
        );
        assert_field_error(
            AppSettingsUpdate {
                chaos_smtp_reject_code: Some(500),
                ..AppSettingsUpdate::default()
            },
            "chaos_smtp_reject_code",
        );
    }

    // AC: PL-05.2
    #[test]
    fn malformed_text_names_its_field() {
        assert_field_error(
            AppSettingsUpdate {
                relay_smtp_url: Some(Some("http://relay".to_owned())),
                ..AppSettingsUpdate::default()
            },
            "relay_smtp_url",
        );
        assert_field_error(
            AppSettingsUpdate {
                spamassassin_address: Some(Some("no-port".to_owned())),
                ..AppSettingsUpdate::default()
            },
            "spamassassin_address",
        );
        assert_field_error(
            AppSettingsUpdate {
                otp_patterns: Some(vec!["\\d{6}".to_owned()]),
                ..AppSettingsUpdate::default()
            },
            "otp_patterns",
        );
        assert_field_error(
            AppSettingsUpdate {
                otp_patterns: Some(vec!["(unclosed".to_owned()]),
                ..AppSettingsUpdate::default()
            },
            "otp_patterns",
        );
        assert_field_error(
            AppSettingsUpdate {
                payment_default_currency: Some("usd".to_owned()),
                ..AppSettingsUpdate::default()
            },
            "payment_default_currency",
        );
    }

    #[test]
    fn valid_values_and_null_clears_pass() {
        let update = AppSettingsUpdate {
            max_emails: Some(500),
            max_age_days: Some(None),
            spamassassin_address: Some(Some("127.0.0.1:783".to_owned())),
            otp_patterns: Some(vec![
                "code (\\d{6})".to_owned(),
                "(?P<code>\\d{4})".to_owned(),
            ]),
            ..AppSettingsUpdate::default()
        };

        assert!(validate_settings_update(&update).is_ok());
    }
}
