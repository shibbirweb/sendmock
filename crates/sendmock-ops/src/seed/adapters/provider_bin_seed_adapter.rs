use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::provider_bins::{AttachProviderBinOperation, ProviderArea, ProviderBinAttachment};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::PROVIDER_BINS_SECTION;
use crate::{Operation, OperationContext, OperationError};

/// `[[http.provider_bins]]`, matched by `area` and `provider`: the bin that answers the
/// provider's unmatched requests, made when no bin has its name.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct SeedProviderBin {
    /// `email`, `sms`, `push` or `payments`.
    area: ProviderArea,
    /// The provider's key, such as `twilio`.
    provider: String,
    /// The bin's name.
    bin: String,
}

pub struct ProviderBinSeedAdapter;

impl ProviderBinSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_provider_bin: SeedProviderBin = read_seed_table(item_table)?;
        let attached_bin = AttachProviderBinOperation
            .execute(
                operation_context,
                ProviderBinAttachment {
                    area: seed_provider_bin.area,
                    provider_key: seed_provider_bin.provider.trim().to_owned(),
                    bin_name: seed_provider_bin.bin,
                },
            )
            .await?;
        Ok(format!(
            "{} {}",
            attached_bin.area.as_str(),
            attached_bin.provider_key
        ))
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_provider_bins = operation_context
            .http_catcher_stores
            .provider_bins
            .list_provider_bins()
            .await?;
        stored_provider_bins
            .into_iter()
            .filter_map(|stored_provider_bin| {
                let area = ProviderArea::parse(&stored_provider_bin.area)?;
                Some((area, stored_provider_bin))
            })
            .map(|(area, stored_provider_bin)| {
                Ok(SeedItem {
                    item_key: format!("{} {}", area.as_str(), stored_provider_bin.provider_key),
                    item_name: stored_provider_bin.provider_key.clone(),
                    table: write_seed_table(&SeedProviderBin {
                        area,
                        provider: stored_provider_bin.provider_key,
                        bin: stored_provider_bin.bin_name,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let provider_bins = &operation_context.http_catcher_stores.provider_bins;
        for stored_provider_bin in provider_bins.list_provider_bins().await? {
            let item_key = format!(
                "{} {}",
                stored_provider_bin.area, stored_provider_bin.provider_key
            );
            if !kept_item_keys.contains(&item_key) {
                provider_bins
                    .delete_provider_bin(
                        &stored_provider_bin.area,
                        &stored_provider_bin.provider_key,
                    )
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(
    ProviderBinSeedAdapter,
    PROVIDER_BINS_SECTION,
    SeedProviderBin
);
