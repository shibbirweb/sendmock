use super::http_bin_presets::preset_default_response;
use super::http_catcher_views::present_http_bin;
use super::http_catcher_wire::{HttpBin, HttpBinInput, HttpBinReference, HttpBinUpdate};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

fn write_json(value: &impl serde::Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// A bin's name is its path under `/catch/`: letters, digits, `-` and `_`.
fn check_bin_name(bin_name: &str) -> Result<(), OperationError> {
    let is_valid = !bin_name.is_empty()
        && bin_name.len() <= 64
        && bin_name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'));
    if is_valid {
        Ok(())
    } else {
        Err(OperationError::InvalidInput {
            message: "Use 1 to 64 letters, digits, - or _".to_owned(),
            field: Some("name".to_owned()),
        })
    }
}

pub struct ListHttpBinsOperation;

impl Operation for ListHttpBinsOperation {
    type Input = NoInput;
    type Output = Vec<HttpBin>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getHttpBins",
            method: HttpMethod::Get,
            path: "/api/v1/http/bins",
            summary: "Bins, each a capture URL with its own responses.",
            is_read_only: true,
            cli_usage: "sendmock http bin list",
            mcp_tool: "sendmock_http_bin_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<HttpBin>, OperationError> {
        let stored_bins = operation_context
            .http_catcher_stores
            .bins
            .list_bins()
            .await?;
        Ok(stored_bins.iter().map(present_http_bin).collect())
    }
}

pub struct CreateHttpBinOperation;

impl Operation for CreateHttpBinOperation {
    type Input = HttpBinInput;
    type Output = HttpBin;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postHttpBins",
            method: HttpMethod::Post,
            path: "/api/v1/http/bins",
            summary: "Add a bin; 409 when the name is taken.",
            cli_usage: "sendmock http bin create",
            mcp_tool: "sendmock_http_bin_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpBinInput,
    ) -> Result<HttpBin, OperationError> {
        let bin_name = input.name.trim().to_owned();
        check_bin_name(&bin_name)?;
        let http_bins = &operation_context.http_catcher_stores.bins;
        if http_bins.find_bin_by_name(&bin_name).await?.is_some() {
            return Err(OperationError::Conflict {
                code: "bin_exists",
                message: format!("A bin named {bin_name} already exists"),
            });
        }
        let preset_name = input
            .preset
            .map(|preset| {
                serde_json::to_value(preset)
                    .ok()
                    .and_then(|value| value.as_str().map(str::to_owned))
            })
            .unwrap_or_default();
        let new_bin = sendmock_store::HttpBinRecord {
            bin_id: operation_context.id_generator.generate_id().to_string(),
            name: bin_name,
            preset: preset_name,
            default_response_json: write_json(&preset_default_response(input.preset))?,
            rules_json: "[]".to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
            request_count: 0,
            last_request_at_unix_ms: None,
        };
        Ok(present_http_bin(&http_bins.insert_bin_once(new_bin).await?))
    }
}

pub struct UpdateHttpBinOperation;

impl Operation for UpdateHttpBinOperation {
    type Input = HttpBinUpdate;
    type Output = HttpBin;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchHttpBinsByBinId",
            method: HttpMethod::Patch,
            path: "/api/v1/http/bins/{binId}",
            summary: "Change a bin's default response.",
            cli_usage: "sendmock http bin update <binId>",
            mcp_tool: "sendmock_http_bin_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpBinUpdate,
    ) -> Result<HttpBin, OperationError> {
        let http_bins = &operation_context.http_catcher_stores.bins;
        let stored_bin = find_bin_or_not_found(operation_context, &input.bin_id).await?;
        http_bins
            .update_bin_answers(
                &input.bin_id,
                write_json(&input.default_response)?,
                stored_bin.rules_json,
            )
            .await?;
        Ok(present_http_bin(
            &find_bin_or_not_found(operation_context, &input.bin_id).await?,
        ))
    }
}

pub async fn find_bin_or_not_found(
    operation_context: &OperationContext,
    bin_id: &str,
) -> Result<sendmock_store::HttpBinRecord, OperationError> {
    operation_context
        .http_catcher_stores
        .bins
        .find_bin(bin_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No bin with id {bin_id}"),
        })
}

pub struct DeleteHttpBinOperation;

impl Operation for DeleteHttpBinOperation {
    type Input = HttpBinReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteHttpBinsByBinId",
            method: HttpMethod::Delete,
            path: "/api/v1/http/bins/{binId}",
            summary: "Delete a bin and its requests.",
            is_destructive: true,
            cli_usage: "sendmock http bin delete <binId>",
            mcp_tool: "sendmock_http_bin_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpBinReference,
    ) -> Result<NoContent, OperationError> {
        if !operation_context
            .http_catcher_stores
            .bins
            .delete_bin(&input.bin_id)
            .await?
        {
            find_bin_or_not_found(operation_context, &input.bin_id).await?;
        }
        Ok(NoContent)
    }
}
