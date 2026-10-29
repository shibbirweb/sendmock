use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

/// Retention limits given at startup; they overwrite the stored settings when set.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RetentionConfig {
    pub max_emails: Option<u64>,
    pub max_age_days: Option<u32>,
}

impl RetentionConfig {
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
        Ok(Self {
            max_emails: serve_arguments.max_emails.or(config_file.max_emails),
            max_age_days,
        })
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

        let retention_config = RetentionConfig::resolve(&serve_arguments, &config_file);

        assert_eq!(
            retention_config.ok(),
            Some(RetentionConfig {
                max_emails: Some(50),
                max_age_days: Some(3),
            })
        );
    }
}
