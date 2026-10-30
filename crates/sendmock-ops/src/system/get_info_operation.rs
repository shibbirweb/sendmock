use super::app_info::AppInfo;
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
    OperationSelector,
};

const MILLISECONDS_PER_SECOND: i64 = 1000;

pub struct GetInfoOperation;

impl Operation for GetInfoOperation {
    type Input = NoInput;
    type Output = AppInfo;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getInfo",
            method: HttpMethod::Get,
            path: "/api/v1/info",
            summary: "Version, listen addresses and enabled features.",
            is_read_only: true,
            cli_usage: "sendmock status",
            mcp_tool: "sendmock_status",
            selector: Some(OperationSelector::by_value("view", "info")),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<AppInfo, OperationError> {
        let instance_details = &operation_context.instance_details;
        let uptime_ms = operation_context.clock.now_unix_ms() - instance_details.started_at_unix_ms;
        Ok(AppInfo {
            version: instance_details.version.to_owned(),
            channel: instance_details.channel,
            uptime_seconds: u64::try_from(uptime_ms / MILLISECONDS_PER_SECOND).unwrap_or_default(),
            smtp_address: instance_details.smtp_address.clone(),
            http_address: instance_details.http_address.clone(),
            provider_address: instance_details.provider_address.clone(),
            database_path: operation_context.database.location().to_string(),
            database_size_bytes: operation_context.database.size_bytes().await?,
            is_container: instance_details.is_container,
            available_operations: crate::build_operation_registry()
                .operations()
                .iter()
                .map(|operation| operation.definition().operation_id.to_owned())
                .collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use sendmock_core::FixedClock;
    use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};

    use super::*;
    use crate::{InstanceDetails, ReleaseChannel};

    fn build_operation_context(now_unix_ms: i64) -> Result<OperationContext, OperationError> {
        Ok(OperationContext::new(
            Arc::new(Database::open(
                DatabaseLocation::InMemory,
                EMBEDDED_MIGRATIONS,
            )?),
            Arc::new(FixedClock::new(now_unix_ms)),
            Arc::new(sendmock_core::SystemIdGenerator),
            InstanceDetails {
                version: "0.1.0",
                channel: ReleaseChannel::Dev,
                started_at_unix_ms: 1_767_225_600_000,
                http_address: "127.0.0.1:8025".to_owned(),
                smtp_address: "127.0.0.1:1025".to_owned(),
                provider_address: None,
                is_container: false,
            },
        ))
    }

    #[tokio::test]
    async fn reports_the_instance_the_database_and_whole_seconds_of_uptime()
    -> Result<(), OperationError> {
        let ninety_seconds_and_a_half_later = 1_767_225_600_000 + 90_500;
        let operation_context = build_operation_context(ninety_seconds_and_a_half_later)?;

        let app_info = GetInfoOperation
            .execute(&operation_context, NoInput {})
            .await?;

        assert_eq!(app_info.version, "0.1.0");
        assert_eq!(app_info.channel, ReleaseChannel::Dev);
        assert_eq!(app_info.uptime_seconds, 90);
        assert_eq!(app_info.http_address, "127.0.0.1:8025");
        assert_eq!(app_info.smtp_address, "127.0.0.1:1025");
        assert_eq!(app_info.provider_address, None);
        assert_eq!(app_info.database_path, "memory");
        assert!(app_info.database_size_bytes > 0);
        assert!(!app_info.is_container);
        assert!(
            app_info
                .available_operations
                .iter()
                .any(|operation_id| operation_id == "getEmails")
        );
        Ok(())
    }

    // AC: UI-12.1
    #[tokio::test]
    async fn lists_exactly_the_operations_this_binary_serves() -> Result<(), OperationError> {
        let app_info = GetInfoOperation
            .execute(&build_operation_context(1_767_225_690_000)?, NoInput {})
            .await?;

        let served_operation_ids: Vec<String> = crate::build_operation_registry()
            .operations()
            .iter()
            .map(|operation| operation.definition().operation_id.to_owned())
            .collect();
        assert_eq!(app_info.available_operations, served_operation_ids);
        assert!(
            !app_info
                .available_operations
                .iter()
                .any(|operation_id| operation_id == "getPayments")
        );
        Ok(())
    }

    #[tokio::test]
    async fn the_registry_runs_it_from_json() -> Result<(), OperationError> {
        let operation_context = build_operation_context(1_767_225_600_000)?;
        let operation_registry = crate::build_operation_registry();

        let info_operation = operation_registry
            .find_by_operation_id("getInfo")
            .ok_or_else(|| OperationError::Internal("getInfo is not registered".to_owned()))?;
        let app_info_json = info_operation
            .execute_answer(&operation_context, serde_json::json!({}))
            .await?;
        let crate::OperationAnswer::Json(app_info_json) = app_info_json else {
            return Err(OperationError::Internal(
                "info answered without JSON".to_owned(),
            ));
        };

        assert_eq!(app_info_json["database_path"], "memory");
        assert_eq!(app_info_json["channel"], "dev");
        Ok(())
    }
}
