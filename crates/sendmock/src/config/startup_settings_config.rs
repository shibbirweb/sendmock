use sendmock_ops::UpdateCheckMode;

use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

/// Runtime settings given at startup; each one set overwrites the stored setting.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct StartupSettingsConfig {
    pub max_emails: Option<u64>,
    pub max_sms: Option<u64>,
    pub max_age_days: Option<u32>,
    pub update_check_mode: Option<UpdateCheckMode>,
    /// `host:port` of a spamd, from `--spamassassin`.
    pub spamassassin_address: Option<String>,
    /// From `--relay-smtp`.
    pub relay_smtp_url: Option<String>,
    /// From `--relay-allowlist`, one glob per entry.
    pub relay_recipient_allowlist: Option<Vec<String>>,
}

impl StartupSettingsConfig {
    pub fn resolve(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
    ) -> Result<Self, ConfigError> {
        let max_age_days = match serve_arguments
            .max_age
            .as_ref()
            .or(config_file.max_age.as_ref())
        {
            Some(age_setting) => {
                Some(
                    parse_days(age_setting).ok_or_else(|| ConfigError::InvalidSetting {
                        setting_name: "max_age",
                        reason: format!("{age_setting} is not a number of days such as 7d"),
                    })?,
                )
            }
            None => None,
        };
        let update_check_mode = match serve_arguments
            .update_check
            .as_ref()
            .or(config_file.update_check.as_ref())
        {
            Some(mode_setting) => Some(parse_update_check_mode(mode_setting).ok_or_else(|| {
                ConfigError::InvalidSetting {
                    setting_name: "update_check",
                    reason: format!("{mode_setting} is not off, manual or daily"),
                }
            })?),
            None => None,
        };
        Ok(Self {
            max_emails: serve_arguments.max_emails.or(config_file.max_emails),
            max_sms: serve_arguments.max_sms.or(config_file.max_sms),
            max_age_days,
            update_check_mode,
            spamassassin_address: resolve_spamassassin_address(serve_arguments, config_file)?,
            relay_smtp_url: resolve_relay_smtp_url(serve_arguments, config_file)?,
            relay_recipient_allowlist: serve_arguments
                .relay_allowlist
                .as_ref()
                .or(config_file.relay_allowlist.as_ref())
                .map(|allowlist_text| split_allowlist(allowlist_text)),
        })
    }
}

fn resolve_spamassassin_address(
    serve_arguments: &ServeArguments,
    config_file: &ConfigFile,
) -> Result<Option<String>, ConfigError> {
    let Some(spamd_address) = serve_arguments
        .spamassassin
        .as_ref()
        .or(config_file.spamassassin.as_ref())
    else {
        return Ok(None);
    };
    let has_port = spamd_address
        .rsplit_once(':')
        .is_some_and(|(host, port_text)| !host.is_empty() && port_text.parse::<u16>().is_ok());
    if !has_port {
        return Err(ConfigError::InvalidSetting {
            setting_name: "spamassassin",
            reason: format!("{spamd_address} is not host:port, such as 127.0.0.1:783"),
        });
    }
    Ok(Some(spamd_address.trim().to_owned()))
}

fn resolve_relay_smtp_url(
    serve_arguments: &ServeArguments,
    config_file: &ConfigFile,
) -> Result<Option<String>, ConfigError> {
    let Some(relay_url) = serve_arguments
        .relay_smtp
        .as_ref()
        .or(config_file.relay_smtp.as_ref())
    else {
        return Ok(None);
    };
    let relay_url = relay_url.trim();
    if !(relay_url.starts_with("smtp://") || relay_url.starts_with("smtps://")) {
        return Err(ConfigError::InvalidSetting {
            setting_name: "relay_smtp",
            reason: "use smtp:// or smtps://, such as smtp://user:password@smtp.example.com:587"
                .to_owned(),
        });
    }
    Ok(Some(relay_url.to_owned()))
}

/// `*@a.test, qa@b.test` as its patterns, without blanks.
fn split_allowlist(allowlist_text: &str) -> Vec<String> {
    allowlist_text
        .split(',')
        .map(str::trim)
        .filter(|allowed_pattern| !allowed_pattern.is_empty())
        .map(str::to_owned)
        .collect()
}

fn parse_update_check_mode(mode_setting: &str) -> Option<UpdateCheckMode> {
    match mode_setting.trim() {
        "off" => Some(UpdateCheckMode::Off),
        "manual" => Some(UpdateCheckMode::Manual),
        "daily" => Some(UpdateCheckMode::Daily),
        _ => None,
    }
}

/// `7d` or `7` is seven days.
fn parse_days(age_setting: &str) -> Option<u32> {
    let day_count_text = age_setting.trim();
    let day_count_text = day_count_text.strip_suffix('d').unwrap_or(day_count_text);
    day_count_text
        .trim()
        .parse()
        .ok()
        .filter(|day_count| *day_count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_days_with_or_without_the_unit() {
        assert_eq!(parse_days("7d"), Some(7));
        assert_eq!(parse_days("30"), Some(30));
        assert_eq!(parse_days("0d"), None);
        assert_eq!(parse_days("a week"), None);
    }

    // AC: EM-03.2
    #[test]
    fn a_flag_wins_over_the_file() {
        let serve_arguments = ServeArguments {
            max_emails: Some(50),
            ..ServeArguments::default()
        };
        let config_file = ConfigFile {
            max_emails: Some(500),
            max_age: Some("3d".to_owned()),
            ..ConfigFile::default()
        };

        let retention_config = StartupSettingsConfig::resolve(&serve_arguments, &config_file);

        assert_eq!(
            retention_config.ok(),
            Some(StartupSettingsConfig {
                max_emails: Some(50),
                max_sms: None,
                max_age_days: Some(3),
                update_check_mode: None,
                spamassassin_address: None,
                relay_smtp_url: None,
                relay_recipient_allowlist: None,
            })
        );
    }

    // AC: PL-08.3
    #[test]
    fn the_sms_limit_comes_from_the_flag_over_the_file() {
        let from_flag = StartupSettingsConfig::resolve(
            &ServeArguments {
                max_sms: Some(0),
                ..ServeArguments::default()
            },
            &ConfigFile {
                max_sms: Some(300),
                ..ConfigFile::default()
            },
        );
        let from_file = StartupSettingsConfig::resolve(
            &ServeArguments::default(),
            &ConfigFile {
                max_sms: Some(300),
                ..ConfigFile::default()
            },
        );

        assert_eq!(from_flag.ok().and_then(|config| config.max_sms), Some(0));
        assert_eq!(from_file.ok().and_then(|config| config.max_sms), Some(300));
    }

    // AC: PL-05.10
    #[test]
    fn the_update_check_mode_comes_from_the_environment_or_the_file() {
        let config_file = ConfigFile {
            update_check: Some("daily".to_owned()),
            ..ConfigFile::default()
        };
        let invalid_file = ConfigFile {
            update_check: Some("hourly".to_owned()),
            ..ConfigFile::default()
        };

        let from_file = StartupSettingsConfig::resolve(&ServeArguments::default(), &config_file);

        assert_eq!(
            from_file
                .ok()
                .and_then(|settings| settings.update_check_mode),
            Some(UpdateCheckMode::Daily)
        );
        assert!(StartupSettingsConfig::resolve(&ServeArguments::default(), &invalid_file).is_err());
    }

    // AC: EM-13.3
    #[test]
    fn the_spamassassin_flag_needs_a_host_and_port() {
        let with_flag = ServeArguments {
            spamassassin: Some("127.0.0.1:783".to_owned()),
            ..ServeArguments::default()
        };
        let without_port = ServeArguments {
            spamassassin: Some("spamd".to_owned()),
            ..ServeArguments::default()
        };

        let resolved = StartupSettingsConfig::resolve(&with_flag, &ConfigFile::default());
        let refused = StartupSettingsConfig::resolve(&without_port, &ConfigFile::default());

        assert_eq!(
            resolved
                .ok()
                .and_then(|settings| settings.spamassassin_address),
            Some("127.0.0.1:783".to_owned())
        );
        assert!(refused.is_err());
    }

    // AC: EM-14.1
    #[test]
    fn the_relay_flags_need_an_smtp_url_and_split_the_allowlist() {
        let with_relay = ServeArguments {
            relay_smtp: Some("smtps://mailer:pw@smtp.example.test".to_owned()),
            relay_allowlist: Some("*@qa.example.test, lead@example.test,".to_owned()),
            ..ServeArguments::default()
        };
        let with_web_url = ServeArguments {
            relay_smtp: Some("https://smtp.example.test".to_owned()),
            ..ServeArguments::default()
        };

        let resolved = StartupSettingsConfig::resolve(&with_relay, &ConfigFile::default());
        let refused = StartupSettingsConfig::resolve(&with_web_url, &ConfigFile::default());

        let resolved = resolved.ok().unwrap_or_default();
        assert_eq!(
            resolved.relay_smtp_url.as_deref(),
            Some("smtps://mailer:pw@smtp.example.test")
        );
        assert_eq!(
            resolved.relay_recipient_allowlist,
            Some(vec![
                "*@qa.example.test".to_owned(),
                "lead@example.test".to_owned()
            ])
        );
        assert!(refused.is_err());
    }
}
