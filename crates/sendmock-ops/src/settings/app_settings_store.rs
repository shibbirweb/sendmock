use std::sync::Arc;

use sendmock_store::{SettingsRepository, StoreError};
use tokio::sync::RwLock;

use super::app_settings::AppSettings;

/// All settings live under one key, as one JSON object.
const APP_SETTINGS_KEY: &str = "app";

/// The settings, read from the database once and kept in memory, so every message can
/// read them without a query; a save writes both.
#[derive(Clone)]
pub struct AppSettingsStore {
    settings_repository: SettingsRepository,
    cached_settings: Arc<RwLock<Option<AppSettings>>>,
}

impl AppSettingsStore {
    pub fn new(settings_repository: SettingsRepository) -> Self {
        Self {
            settings_repository,
            cached_settings: Arc::default(),
        }
    }

    pub async fn current(&self) -> Result<AppSettings, StoreError> {
        if let Some(cached_settings) = self.cached_settings.read().await.as_ref() {
            return Ok(cached_settings.clone());
        }
        let stored_settings = self
            .settings_repository
            .read_value(APP_SETTINGS_KEY)
            .await?
            .map(|settings_json| AppSettings::from_stored_json(&settings_json))
            .unwrap_or_default();
        *self.cached_settings.write().await = Some(stored_settings);
        Ok(self
            .cached_settings
            .read()
            .await
            .clone()
            .unwrap_or_default())
    }

    pub async fn save(
        &self,
        settings: AppSettings,
        saved_at_unix_ms: i64,
    ) -> Result<AppSettings, StoreError> {
        let settings_json = serde_json::to_string(&settings).unwrap_or_else(|_| "{}".to_owned());
        self.settings_repository
            .write_value(APP_SETTINGS_KEY, settings_json, saved_at_unix_ms)
            .await?;
        *self.cached_settings.write().await = Some(settings.clone());
        Ok(settings)
    }
}
