use std::collections::BTreeMap;

use sendmock_store::SavedWebhookDeliveryRecord;
use serde::{Deserialize, Serialize};

use super::endpoint_names::EndpointNames;
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::SAVED_DELIVERIES_SECTION;
use crate::{OperationContext, OperationError, RecordedHttpRequest};

/// `[[webhook.saved]]`, matched by `name`: the request as saved, without signature headers,
/// which are made on every send. Saved deliveries survive reset, as they do in the UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedSavedDelivery {
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    endpoint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    event: Option<String>,
    #[serde(default = "default_template")]
    template: String,
    #[serde(default = "default_method")]
    method: String,
    url: String,
    #[serde(default, deserialize_with = "read_headers")]
    headers: BTreeMap<String, String>,
    #[serde(default)]
    body: String,
}

fn default_template() -> String {
    "native".to_owned()
}

fn default_method() -> String {
    "POST".to_owned()
}

/// Headers as a table, or as `"Name: value"` lines as the demo exports them.
fn read_headers<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<BTreeMap<String, String>, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum HeaderForms {
        Table(BTreeMap<String, String>),
        Lines(Vec<String>),
    }
    Ok(match HeaderForms::deserialize(deserializer)? {
        HeaderForms::Table(headers) => headers,
        HeaderForms::Lines(header_lines) => header_lines
            .iter()
            .filter_map(|header_line| header_line.split_once(':'))
            .map(|(header_name, header_value)| {
                (
                    header_name.trim().to_owned(),
                    header_value.trim().to_owned(),
                )
            })
            .collect(),
    })
}

pub struct SavedDeliverySeedAdapter;

impl SavedDeliverySeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_saved: SeedSavedDelivery = read_seed_table(item_table)?;
        let saved_name = seed_saved.name.trim().to_owned();
        if saved_name.is_empty() {
            return Err(OperationError::InvalidInput {
                message: "Enter a name".to_owned(),
                field: Some("name".to_owned()),
            });
        }
        let endpoint_id = match seed_saved.endpoint.as_deref() {
            Some(endpoint_name) => Some(
                EndpointNames::load(operation_context)
                    .await?
                    .find_id(endpoint_name)?,
            ),
            None => None,
        };
        let saved_repository = &operation_context.saved_webhook_delivery_repository;
        let existing_saved = saved_repository
            .list_saved_deliveries()
            .await?
            .into_iter()
            .find(|stored_saved| stored_saved.name == saved_name);
        let seeded_saved = build_seeded_saved(
            operation_context,
            seed_saved,
            endpoint_id,
            existing_saved.as_ref(),
        )?;
        if existing_saved.as_ref() != Some(&seeded_saved) {
            if let Some(existing_saved) = &existing_saved {
                saved_repository
                    .delete_saved_delivery(&existing_saved.saved_id)
                    .await?;
            }
            saved_repository.insert_saved_delivery(seeded_saved).await?;
        }
        Ok(saved_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let endpoint_names = EndpointNames::load(operation_context).await?;
        let stored_saved_deliveries = operation_context
            .saved_webhook_delivery_repository
            .list_saved_deliveries()
            .await?;
        stored_saved_deliveries
            .into_iter()
            .map(|stored_saved| {
                let saved_request: RecordedHttpRequest =
                    serde_json::from_str(&stored_saved.request_json)
                        .unwrap_or_else(|_| RecordedHttpRequest::empty_post());
                Ok(SeedItem {
                    item_key: stored_saved.name.clone(),
                    item_name: stored_saved.name.clone(),
                    table: write_seed_table(&SeedSavedDelivery {
                        name: stored_saved.name,
                        endpoint: stored_saved
                            .endpoint_id
                            .as_deref()
                            .and_then(|endpoint_id| endpoint_names.find_name(endpoint_id)),
                        event: stored_saved.event_type,
                        template: stored_saved.template_id,
                        method: saved_request.method,
                        url: saved_request.url,
                        headers: saved_request.headers,
                        body: saved_request.body,
                    })?,
                })
            })
            .collect()
    }

    /// Saved deliveries are kept on reset, as they are without a seed (WH-10.1).
    async fn remove_unlisted(
        _operation_context: &OperationContext,
        _kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        Ok(())
    }
}

/// The record as stored; an existing one keeps its id, save time and the event it carried.
fn build_seeded_saved(
    operation_context: &OperationContext,
    seed_saved: SeedSavedDelivery,
    endpoint_id: Option<String>,
    existing_saved: Option<&SavedWebhookDeliveryRecord>,
) -> Result<SavedWebhookDeliveryRecord, OperationError> {
    let request_json = serde_json::to_string(&RecordedHttpRequest {
        method: seed_saved.method.to_ascii_uppercase(),
        url: seed_saved.url,
        headers: seed_saved.headers,
        body: seed_saved.body,
    })
    .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    Ok(SavedWebhookDeliveryRecord {
        saved_id: existing_saved.map_or_else(
            || operation_context.id_generator.generate_id().to_string(),
            |stored_saved| stored_saved.saved_id.clone(),
        ),
        name: seed_saved.name.trim().to_owned(),
        endpoint_id,
        event_type: seed_saved.event,
        event_json: existing_saved.and_then(|stored_saved| stored_saved.event_json.clone()),
        template_id: seed_saved.template,
        request_json,
        saved_at_unix_ms: existing_saved.map_or_else(
            || operation_context.clock.now_unix_ms(),
            |stored_saved| stored_saved.saved_at_unix_ms,
        ),
    })
}

impl_seed_section_adapter!(SavedDeliverySeedAdapter, SAVED_DELIVERIES_SECTION);
