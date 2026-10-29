use sendmock_ops::UpdateCheckMode;

use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

/// Runtime settings given at startup; each one set overwrites the stored setting.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct StartupSettingsConfig {
    pub max_emails: Option<u64>,
    pub max_age_days: Option<u32>,
    pub update_check_mode: Option<UpdateCheckMode>,
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
            max_age_days,
            update_check_mode,
        })
    }
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
                max_age_days: Some(3),
                update_check_mode: None,
            })
        );
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
}
