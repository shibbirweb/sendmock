use sendmock_store::MessagingServiceRecord;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::numbers::{MessagingServiceInput, build_messaging_service};
use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, to_api_input,
    write_seed_table,
};
use crate::seed::seed_sections::MESSAGING_SERVICES_SECTION;
use crate::{OperationContext, OperationError};

/// `[[messaging_services]]`, matched by `sid`. Numbers join a service through their own
/// `messaging_service` field, so the pool is not listed here.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedMessagingService {
    sid: String,
    name: String,
    #[serde(default = "default_inbound_mode")]
    inbound_mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inbound_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    inbound_fallback_url: Option<String>,
}

fn default_inbound_mode() -> String {
    "defer_to_sender".to_owned()
}

/// `MG` and 32 hex digits, as Twilio writes Messaging Service SIDs.
fn is_messaging_service_sid(service_sid: &str) -> bool {
    service_sid.len() == 34
        && service_sid.starts_with("MG")
        && service_sid[2..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

pub struct MessagingServiceSeedAdapter;

impl MessagingServiceSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_service: SeedMessagingService = read_seed_table(item_table)?;
        if !is_messaging_service_sid(&seed_service.sid) {
            return Err(OperationError::InvalidInput {
                message: "sid must be MG and 32 hex digits".to_owned(),
                field: Some("sid".to_owned()),
            });
        }
        let existing_service = operation_context
            .messaging_service_repository
            .find_service(&seed_service.sid)
            .await?
            .unwrap_or_else(|| MessagingServiceRecord {
                service_sid: seed_service.sid.clone(),
                friendly_name: String::new(),
                number_ids: Vec::new(),
                inbound_mode: default_inbound_mode(),
                inbound_url: None,
                inbound_fallback_url: None,
                created_by: CREATED_BY_SEED.to_owned(),
                created_at_unix_ms: operation_context.clock.now_unix_ms(),
            });
        let service_input: MessagingServiceInput = to_api_input(json!({
            "friendly_name": seed_service.name,
            "number_ids": existing_service.number_ids,
            "inbound_mode": seed_service.inbound_mode,
            "inbound_url": seed_service.inbound_url,
            "inbound_fallback_url": seed_service.inbound_fallback_url,
        }))?;
        let mut seeded_service =
            build_messaging_service(operation_context, service_input, Some(existing_service))
                .await?;
        seeded_service.created_by = CREATED_BY_SEED.to_owned();
        operation_context
            .messaging_service_repository
            .save_service(seeded_service)
            .await?;
        Ok(seed_service.sid)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_services = operation_context
            .messaging_service_repository
            .list_services()
            .await?;
        stored_services
            .into_iter()
            .map(|stored_service| {
                Ok(SeedItem {
                    item_key: stored_service.service_sid.clone(),
                    item_name: stored_service.friendly_name.clone(),
                    table: write_seed_table(&SeedMessagingService {
                        sid: stored_service.service_sid,
                        name: stored_service.friendly_name,
                        inbound_mode: stored_service.inbound_mode,
                        inbound_url: stored_service.inbound_url,
                        inbound_fallback_url: stored_service.inbound_fallback_url,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let messaging_service_repository = &operation_context.messaging_service_repository;
        for stored_service in messaging_service_repository.list_services().await? {
            if !kept_item_keys.contains(&stored_service.service_sid) {
                messaging_service_repository
                    .delete_service(&stored_service.service_sid)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(MessagingServiceSeedAdapter, MESSAGING_SERVICES_SECTION);
