mod app_settings;
mod app_settings_store;
mod app_settings_update;
mod otp_extractor_cache;
mod reset_operation;
mod setting_choices;
mod settings_operations;
mod settings_validation;
mod traffic_retention;

pub use app_settings::{AppSettings, mask_url_password};
pub use app_settings_store::AppSettingsStore;
pub use app_settings_update::AppSettingsUpdate;
pub use reset_operation::ResetOperation;
pub use setting_choices::{
    EmailOutcomeProfile, OpenedEventMode, PaymentOutcomeProfile, SmsSimulationProfile,
    UpdateCheckMode,
};
pub use settings_operations::{GetSettingsOperation, UpdateSettingsOperation};
pub(crate) use settings_validation::validate_settings_update;
pub use traffic_retention::{
    build_ingest_options, list_unbounded_traffic, prune_traffic, read_ingest_options,
};

use crate::OperationRegistry;

pub fn register_settings_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(GetSettingsOperation);
    operation_registry.register(UpdateSettingsOperation);
    operation_registry.register(ResetOperation);
}
