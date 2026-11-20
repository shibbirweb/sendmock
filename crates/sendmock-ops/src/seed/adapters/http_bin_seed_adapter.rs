use sendmock_store::HttpBinRecord;
use serde::{Deserialize, Serialize};

use crate::http_catcher::{
    HttpBinPreset, HttpMockResponse, HttpResponseRule, check_bin_name, check_response_rule,
    preset_default_response, read_bin_rules,
};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::HTTP_BINS_SECTION;
use crate::{OperationContext, OperationError};

/// `[[http.bins]]`, matched by `name`: the bin, its default reply when it differs from its
/// preset's, and its response rules as `PUT /http/bins/{binId}/responses` takes them.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedHttpBin {
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    preset: Option<HttpBinPreset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    default_response: Option<HttpMockResponse>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    responses: Vec<HttpResponseRule>,
}

fn write_json(value: &impl Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

fn read_stored_preset(stored_bin: &HttpBinRecord) -> Option<HttpBinPreset> {
    stored_bin
        .preset
        .as_deref()
        .and_then(|preset_name| serde_json::from_value(preset_name.into()).ok())
}

pub struct HttpBinSeedAdapter;

impl HttpBinSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_bin: SeedHttpBin = read_seed_table(item_table)?;
        let bin_name = seed_bin.name.trim().to_owned();
        check_bin_name(&bin_name)?;
        for response_rule in &seed_bin.responses {
            check_response_rule(response_rule)?;
        }
        let default_response = seed_bin
            .default_response
            .unwrap_or_else(|| preset_default_response(seed_bin.preset));
        let default_response_json = write_json(&default_response)?;
        let rules_json = write_json(&seed_bin.responses)?;
        let http_bins = &operation_context.http_catcher_stores.bins;
        match http_bins.find_bin_by_name(&bin_name).await? {
            Some(stored_bin) => {
                http_bins
                    .update_bin_answers(&stored_bin.bin_id, default_response_json, rules_json)
                    .await?;
            }
            None => {
                let preset_name = seed_bin.preset.and_then(|preset| {
                    serde_json::to_value(preset)
                        .ok()
                        .and_then(|value| value.as_str().map(str::to_owned))
                });
                http_bins
                    .insert_bin_once(HttpBinRecord {
                        bin_id: operation_context.id_generator.generate_id().to_string(),
                        name: bin_name.clone(),
                        preset: preset_name,
                        default_response_json,
                        rules_json,
                        created_at_unix_ms: operation_context.clock.now_unix_ms(),
                        request_count: 0,
                        last_request_at_unix_ms: None,
                    })
                    .await?;
            }
        }
        Ok(bin_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_bins = operation_context
            .http_catcher_stores
            .bins
            .list_bins()
            .await?;
        stored_bins
            .into_iter()
            .map(|stored_bin| {
                let preset = read_stored_preset(&stored_bin);
                let default_response: HttpMockResponse =
                    serde_json::from_str(&stored_bin.default_response_json)
                        .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
                let is_preset_default = default_response == preset_default_response(preset);
                Ok(SeedItem {
                    item_key: stored_bin.name.clone(),
                    item_name: stored_bin.name.clone(),
                    table: write_seed_table(&SeedHttpBin {
                        responses: read_bin_rules(&stored_bin.rules_json),
                        name: stored_bin.name,
                        preset,
                        default_response: (!is_preset_default).then_some(default_response),
                    })?,
                })
            })
            .collect()
    }

    /// A reset keeps only the seed's bins; their captured requests go with them.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let http_bins = &operation_context.http_catcher_stores.bins;
        for stored_bin in http_bins.list_bins().await? {
            if !kept_item_keys.contains(&stored_bin.name) {
                http_bins.delete_bin(&stored_bin.bin_id).await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(HttpBinSeedAdapter, HTTP_BINS_SECTION);
