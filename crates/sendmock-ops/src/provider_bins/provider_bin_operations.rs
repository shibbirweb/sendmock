use super::provider_area::ProviderArea;
use super::provider_bin_views::{ProviderBin, ProviderBinAttachment, ProviderBinReference};
use crate::http_catcher::{check_bin_name, find_or_create_bin};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListProviderBinsOperation;

impl Operation for ListProviderBinsOperation {
    type Input = NoInput;
    type Output = Vec<ProviderBin>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getProviderBins",
            method: HttpMethod::Get,
            path: "/api/v1/provider-bins",
            summary: "Which HTTP Catcher bin answers each provider's unmatched requests.",
            is_read_only: true,
            cli_usage: "sendmock http provider-bin list",
            mcp_tool: "sendmock_http_provider_bin_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<ProviderBin>, OperationError> {
        let stored_provider_bins = operation_context
            .http_catcher_stores
            .provider_bins
            .list_provider_bins()
            .await?;
        Ok(stored_provider_bins
            .into_iter()
            .filter_map(ProviderBin::from_record)
            .collect())
    }
}

pub struct AttachProviderBinOperation;

impl Operation for AttachProviderBinOperation {
    type Input = ProviderBinAttachment;
    type Output = ProviderBin;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "putProviderBinsByAreaByProviderKey",
            method: HttpMethod::Put,
            path: "/api/v1/provider-bins/{area}/{providerKey}",
            summary: "Send a provider's unmatched requests to an HTTP Catcher bin, made if new.",
            cli_usage: "sendmock http provider-bin attach <area> <providerKey>",
            mcp_tool: "sendmock_http_provider_bin_attach",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderBinAttachment,
    ) -> Result<ProviderBin, OperationError> {
        let bin_name = input.bin_name.trim();
        check_bin_name(bin_name)?;
        check_provider_exists(operation_context, input.area, &input.provider_key).await?;
        let http_bin = find_or_create_bin(operation_context, bin_name).await?;
        let provider_bins = &operation_context.http_catcher_stores.provider_bins;
        provider_bins
            .save_provider_bin(
                input.area.as_str(),
                &input.provider_key,
                &http_bin.bin_id,
                operation_context.clock.now_unix_ms(),
            )
            .await?;
        provider_bins
            .find_provider_bin(input.area.as_str(), &input.provider_key)
            .await?
            .and_then(ProviderBin::from_record)
            .ok_or_else(|| OperationError::Internal("the attached bin was not saved".to_owned()))
    }
}

pub struct DetachProviderBinOperation;

impl Operation for DetachProviderBinOperation {
    type Input = ProviderBinReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteProviderBinsByAreaByProviderKey",
            method: HttpMethod::Delete,
            path: "/api/v1/provider-bins/{area}/{providerKey}",
            summary: "Answer a provider's unmatched requests with its 404 again; the bin stays.",
            is_destructive: true,
            cli_usage: "sendmock http provider-bin detach <area> <providerKey>",
            mcp_tool: "sendmock_http_provider_bin_detach",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Detaching a provider without a bin succeeds.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderBinReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .http_catcher_stores
            .provider_bins
            .delete_provider_bin(input.area.as_str(), &input.provider_key)
            .await?;
        Ok(NoContent)
    }
}

async fn check_provider_exists(
    operation_context: &OperationContext,
    area: ProviderArea,
    provider_key: &str,
) -> Result<(), OperationError> {
    if area.has_provider(operation_context, provider_key).await? {
        Ok(())
    } else {
        Err(OperationError::NotFound {
            message: format!("No {} provider with the key {provider_key}", area.as_str()),
        })
    }
}
