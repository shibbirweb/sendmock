use sendmock_store::VerifyServiceRecord;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, to_api_input,
    write_seed_table,
};
use crate::seed::seed_sections::VERIFY_SERVICES_SECTION;
use crate::verify::{VerifyServiceInput, build_verify_service};
use crate::{OperationContext, OperationError};

/// `[[verify.services]]`, matched by `sid`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedVerifyService {
    sid: String,
    name: String,
    #[serde(default = "default_code_length")]
    code_length: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    fixed_code: Option<String>,
    #[serde(default = "default_ttl_seconds")]
    ttl_seconds: u32,
}

fn default_code_length() -> u32 {
    6
}

fn default_ttl_seconds() -> u32 {
    600
}

/// `VA` and 32 hex digits, as Twilio writes Verify service SIDs.
fn is_verify_service_sid(service_sid: &str) -> bool {
    service_sid.len() == 34
        && service_sid.starts_with("VA")
        && service_sid[2..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

pub struct VerifyServiceSeedAdapter;

impl VerifyServiceSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_service: SeedVerifyService = read_seed_table(item_table)?;
        if !is_verify_service_sid(&seed_service.sid) {
            return Err(OperationError::InvalidInput {
                message: "sid must be VA and 32 hex digits".to_owned(),
                field: Some("sid".to_owned()),
            });
        }
        let existing_service = operation_context
            .verify_service_repository
            .find_service(&seed_service.sid)
            .await?
            .unwrap_or_else(|| VerifyServiceRecord {
                service_sid: seed_service.sid.clone(),
                friendly_name: String::new(),
                code_length: 6,
                fixed_code: None,
                ttl_seconds: 600,
                created_by: CREATED_BY_SEED.to_owned(),
                created_at_unix_ms: operation_context.clock.now_unix_ms(),
            });
        let service_input: VerifyServiceInput = to_api_input(json!({
            "friendly_name": seed_service.name,
            "code_length": seed_service.code_length,
            "fixed_code": seed_service.fixed_code,
            "ttl_seconds": seed_service.ttl_seconds,
        }))?;
        let mut seeded_service = build_verify_service(service_input, existing_service)?;
        seeded_service.created_by = CREATED_BY_SEED.to_owned();
        operation_context
            .verify_service_repository
            .save_service(seeded_service)
            .await?;
        Ok(seed_service.sid)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_services = operation_context
            .verify_service_repository
            .list_services()
            .await?;
        stored_services
            .into_iter()
            .map(|stored_service| {
                Ok(SeedItem {
                    item_key: stored_service.service_sid.clone(),
                    item_name: stored_service.friendly_name.clone(),
                    table: write_seed_table(&SeedVerifyService {
                        sid: stored_service.service_sid,
                        name: stored_service.friendly_name,
                        code_length: stored_service.code_length,
                        fixed_code: stored_service.fixed_code,
                        ttl_seconds: stored_service.ttl_seconds,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let verify_service_repository = &operation_context.verify_service_repository;
        for stored_service in verify_service_repository.list_services().await? {
            if !kept_item_keys.contains(&stored_service.service_sid) {
                verify_service_repository
                    .delete_service(&stored_service.service_sid)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(VerifyServiceSeedAdapter, VERIFY_SERVICES_SECTION);
