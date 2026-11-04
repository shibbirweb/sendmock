use serde_json::Value;

use crate::seed::seed_section_adapter::{SeedItem, impl_seed_section_adapter};
use crate::seed::seed_sections::SETTINGS_SECTION;
use crate::settings::validate_settings_update;
use crate::{AppSettings, AppSettingsUpdate, OperationContext, OperationError};

/// The settings section has one item.
const SETTINGS_ITEM_KEY: &str = "settings";

/// Settings that hold a secret and so never go into a seed file.
const SECRET_SETTINGS: [&str; 1] = ["relay_smtp_url"];

/// `[settings]`: the keys are the settings API's (`PATCH /api/v1/settings`); export writes only
/// the ones that differ from the defaults, so the file stays short.
pub struct SettingsSeedAdapter;

impl SettingsSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let settings_fields = serde_json::to_value(item_table)
            .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
        let settings_update: AppSettingsUpdate =
            serde_json::from_value(settings_fields).map_err(|read_error| {
                OperationError::InvalidInput {
                    message: read_error.to_string(),
                    field: None,
                }
            })?;
        validate_settings_update(&settings_update)?;
        let settings_store = &operation_context.settings_store;
        let current_settings = settings_store.current().await?;
        settings_store
            .save(
                settings_update.apply_to(current_settings),
                operation_context.clock.now_unix_ms(),
            )
            .await?;
        Ok(SETTINGS_ITEM_KEY.to_owned())
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let current_settings = operation_context.settings_store.current().await?;
        Ok(vec![SeedItem {
            item_key: SETTINGS_ITEM_KEY.to_owned(),
            item_name: "Settings".to_owned(),
            table: write_changed_settings(&current_settings)?,
        }])
    }

    /// Reset puts the settings back to their defaults before it applies the seed again.
    async fn remove_unlisted(
        _operation_context: &OperationContext,
        _kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        Ok(())
    }
}

fn write_changed_settings(current_settings: &AppSettings) -> Result<toml::Table, OperationError> {
    let to_fields = |settings: &AppSettings| {
        serde_json::to_value(settings)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))
    };
    let (Value::Object(current_fields), Value::Object(default_fields)) = (
        to_fields(current_settings)?,
        to_fields(&AppSettings::default())?,
    ) else {
        return Ok(toml::Table::new());
    };
    let mut settings_table = toml::Table::new();
    for (setting_name, setting_value) in current_fields {
        let is_default = default_fields.get(&setting_name) == Some(&setting_value);
        if is_default || setting_value.is_null() || SECRET_SETTINGS.contains(&setting_name.as_str())
        {
            continue;
        }
        let toml_value = toml::Value::try_from(setting_value)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        settings_table.insert(setting_name, toml_value);
    }
    Ok(settings_table)
}

impl_seed_section_adapter!(SettingsSeedAdapter, SETTINGS_SECTION);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_only_the_changed_settings_and_never_the_relay_url() {
        let changed_settings = AppSettings {
            sms_failure_rate_percent: 25,
            relay_smtp_url: Some("smtp://user:secret@relay.test:587".to_owned()),
            ..AppSettings::default()
        };

        let settings_table = write_changed_settings(&changed_settings)
            .unwrap_or_else(|error| panic!("a settings table: {error}"));

        assert_eq!(
            settings_table.keys().collect::<Vec<_>>(),
            ["sms_failure_rate_percent"]
        );
        assert_eq!(
            settings_table["sms_failure_rate_percent"].as_integer(),
            Some(25)
        );
    }
}
