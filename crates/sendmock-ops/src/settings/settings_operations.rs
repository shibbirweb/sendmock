use super::app_settings::AppSettings;
use super::app_settings_update::AppSettingsUpdate;
use super::settings_validation::validate_settings_update;
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

pub struct GetSettingsOperation;

impl Operation for GetSettingsOperation {
    type Input = NoInput;
    type Output = AppSettings;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getSettings",
            method: HttpMethod::Get,
            path: "/api/v1/settings",
            summary: "Every runtime setting.",
            is_read_only: true,
            cli_usage: "sendmock settings get",
            mcp_tool: "sendmock_settings_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<AppSettings, OperationError> {
        Ok(operation_context
            .settings_store
            .current()
            .await?
            .with_masked_secrets())
    }
}

pub struct UpdateSettingsOperation;

impl Operation for UpdateSettingsOperation {
    type Input = AppSettingsUpdate;
    type Output = AppSettings;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchSettings",
            method: HttpMethod::Patch,
            path: "/api/v1/settings",
            summary: "Change settings; send only the changed keys.",
            cli_usage: "sendmock settings set",
            mcp_tool: "sendmock_settings_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Applies at once: the next message, SMTP session or pruning run reads the new values.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: AppSettingsUpdate,
    ) -> Result<AppSettings, OperationError> {
        validate_settings_update(&input)?;
        let current_settings = operation_context.settings_store.current().await?;
        let saved_settings = operation_context
            .settings_store
            .save(
                input.apply_to(current_settings),
                operation_context.clock.now_unix_ms(),
            )
            .await?;
        Ok(saved_settings.with_masked_secrets())
    }
}
