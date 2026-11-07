use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::numbers::{VirtualNumberInput, build_virtual_number};
use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, to_api_input,
    write_seed_table,
};
use crate::seed::seed_sections::NUMBERS_SECTION;
use crate::{OperationContext, OperationError};

/// `[[numbers]]`, matched by `number`; applied after the Messaging Services it joins.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedVirtualNumber {
    number: String,
    label: String,
    #[serde(default = "default_channels")]
    channels: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inbound_url: Option<String>,
    #[serde(default = "default_inbound_method")]
    inbound_method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inbound_fallback_url: Option<String>,
    /// The inbound format, a webhook template ID such as `twilio.inbound_sms`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inbound_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    status_callback: Option<String>,
    /// The SID of the Messaging Service whose pool the number is in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    messaging_service: Option<String>,
}

fn default_channels() -> Vec<String> {
    vec!["sms".to_owned()]
}

fn default_inbound_method() -> String {
    "POST".to_owned()
}

pub struct VirtualNumberSeedAdapter;

impl VirtualNumberSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_number: SeedVirtualNumber = read_seed_table(item_table)?;
        let number_repository = &operation_context.virtual_number_repository;
        let existing_number = number_repository
            .find_by_number(seed_number.number.trim())
            .await?;
        let number_input: VirtualNumberInput = to_api_input(json!({
            "number": seed_number.number,
            "label": seed_number.label,
            "channels": seed_number.channels,
            "inbound_url": seed_number.inbound_url,
            "inbound_method": seed_number.inbound_method,
            "inbound_fallback_url": seed_number.inbound_fallback_url,
            "inbound_template_id": seed_number.inbound_template,
            "status_callback_url": seed_number.status_callback,
            "messaging_service_sid": seed_number.messaging_service,
        }))?;
        let is_new_number = existing_number.is_none();
        let mut seeded_number =
            build_virtual_number(operation_context, number_input, existing_number).await?;
        seeded_number.created_by = CREATED_BY_SEED.to_owned();
        let number_key = seeded_number.number.clone();
        if is_new_number {
            number_repository.insert_number(seeded_number).await?;
        } else {
            number_repository.update_number(seeded_number).await?;
        }
        Ok(number_key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_numbers = operation_context
            .virtual_number_repository
            .list_numbers()
            .await?;
        stored_numbers
            .into_iter()
            .map(|stored_number| {
                Ok(SeedItem {
                    item_key: stored_number.number.clone(),
                    item_name: stored_number.number.clone(),
                    table: write_seed_table(&SeedVirtualNumber {
                        number: stored_number.number,
                        label: stored_number.label,
                        channels: stored_number.channels,
                        inbound_url: stored_number.inbound_url,
                        inbound_method: stored_number.inbound_method,
                        inbound_fallback_url: stored_number.inbound_fallback_url,
                        inbound_template: stored_number.inbound_template_id,
                        status_callback: stored_number.status_callback_url,
                        messaging_service: stored_number.messaging_service_sid,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let number_repository = &operation_context.virtual_number_repository;
        for stored_number in number_repository.list_numbers().await? {
            if !kept_item_keys.contains(&stored_number.number) {
                number_repository
                    .delete_number(&stored_number.number_id)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(VirtualNumberSeedAdapter, NUMBERS_SECTION);
