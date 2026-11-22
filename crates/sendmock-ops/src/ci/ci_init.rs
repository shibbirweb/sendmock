//! `sendmock ci init` (WH-15.6): the files that put this instance's setup into a pipeline.

use std::fmt::Write as _;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::ci_pipeline_jobs::CiSystem;
use crate::setup::{ExportSetupOperation, SetupExportRequest, SetupFileFormat};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const SETUP_FILE_PATH: &str = "sendmock.setup.yml";
const CI_FILE_PATH: &str = "sendmock.ci.yml";
const DEFAULT_APP_URL: &str = "http://localhost:8000";

/// Body of `POST /api/v1/ci/init`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct CiInitRequest {
    /// The CI system to write a job for. `sendmock ci init` finds it from the repository.
    pub provider: CiSystem,
    /// Where the pipeline downloads the setup; the written file's path when null.
    #[serde(default)]
    pub setup_url: Option<String>,
    /// The app's base URL in the pipeline [default: http://localhost:8000].
    #[serde(default)]
    pub app_url: Option<String>,
}

/// One file to write.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct CiInitFile {
    /// Relative to the repository's root.
    pub path: String,
    pub content: String,
    /// What it is and what to do with it.
    pub purpose: String,
}

/// Answer of `POST /api/v1/ci/init`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct CiInitFiles {
    pub provider: CiSystem,
    pub files: Vec<CiInitFile>,
}

async fn export_setup_yaml(operation_context: &OperationContext) -> Result<String, OperationError> {
    let exported = ExportSetupOperation
        .execute(
            operation_context,
            SetupExportRequest {
                format: Some(SetupFileFormat::Yaml),
                only: Vec::new(),
                except: Vec::new(),
                include_secrets: false,
                passphrase: None,
            },
        )
        .await?;
    Ok(String::from_utf8_lossy(&exported.bytes).into_owned())
}

/// One scenario per webhook endpoint: send its test event and wait for it to succeed.
async fn build_ci_file(
    operation_context: &OperationContext,
    setup_location: &str,
    app_url: &str,
) -> Result<String, OperationError> {
    let endpoints = operation_context
        .webhook_endpoint_repository
        .list_endpoints()
        .await?;
    let mut ci_file = format!(
        "# Run with: sendmock ci run {CI_FILE_PATH} --junit sendmock-report.xml\nsendmock:\n  format: sendmock.ci\n  format_version: 1\nsetup: {setup_location}\napp_url: {app_url}\nscenarios:\n"
    );
    for stored_endpoint in &endpoints {
        let endpoint_name = serde_json::to_string(&stored_endpoint.name)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        let _ = write!(
            ci_file,
            "  - name: {}\n    steps:\n      - run: webhook.endpoint.test\n        with: {{ endpoint_id: {endpoint_name} }}\n      - run: webhook.delivery.wait\n        with: {{ endpoint: {endpoint_name}, status: succeeded, timeout: 10s }}\n",
            serde_json::to_string(&format!(
                "{} accepts a signed webhook",
                stored_endpoint.name
            ))
            .unwrap_or_default()
        );
    }
    if endpoints.is_empty() {
        let _ = write!(
            ci_file,
            "  - name: SendMock answers\n    steps:\n      - run: http\n        with: {{ method: GET, url: /api/v1/health }}\n"
        );
    }
    Ok(ci_file)
}

pub struct InitCiOperation;

impl Operation for InitCiOperation {
    type Input = CiInitRequest;
    type Output = CiInitFiles;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postCiInit",
            method: HttpMethod::Post,
            path: "/api/v1/ci/init",
            summary: "The setup, a starter CI file and the pipeline job for a CI system, from this instance.",
            is_read_only: true,
            cli_usage: "sendmock ci init",
            mcp_tool: "sendmock_ci_init",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: CiInitRequest,
    ) -> Result<CiInitFiles, OperationError> {
        let setup_location = input
            .setup_url
            .clone()
            .filter(|setup_url| !setup_url.trim().is_empty())
            .unwrap_or_else(|| SETUP_FILE_PATH.to_owned());
        let app_url = input
            .app_url
            .clone()
            .unwrap_or_else(|| DEFAULT_APP_URL.to_owned());
        let files = vec![
            CiInitFile {
                path: SETUP_FILE_PATH.to_owned(),
                content: export_setup_yaml(operation_context).await?,
                purpose: "This instance's setup, secrets as ${ENV_VAR} references; commit it, or host it and give its URL.".to_owned(),
            },
            CiInitFile {
                path: CI_FILE_PATH.to_owned(),
                content: build_ci_file(operation_context, &setup_location, &app_url).await?,
                purpose: "The CI file: one scenario per webhook endpoint to start from.".to_owned(),
            },
            CiInitFile {
                path: input.provider.job_path().to_owned(),
                content: input.provider.render_job(),
                purpose: input.provider.describe_job().to_owned(),
            },
        ];
        Ok(CiInitFiles {
            provider: input.provider,
            files,
        })
    }
}
