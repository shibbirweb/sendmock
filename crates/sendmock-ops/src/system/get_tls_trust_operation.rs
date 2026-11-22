use std::sync::Arc;

use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

/// One place that can trust the local CA, and its state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TlsTrustPlace {
    /// The system store or a runtime, such as `PHP 8.4 (/opt/homebrew/bin/php)`.
    pub place: String,
    /// `trusted`, `missing` (`sendmock trust` adds it) or `manual` (set the line in `detail`).
    pub state: String,
    pub detail: String,
}

/// What trusts SendMock's local CA on this machine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TlsTrustReport {
    /// Where the local CA certificate is.
    pub ca_path: String,
    pub places: Vec<TlsTrustPlace>,
}

/// Checks the trust stores of the machine the server runs on; the binary gives one, since
/// it runs the system's own tools.
pub trait TrustInspector: Send + Sync {
    fn inspect_trust(&self) -> Result<TlsTrustReport, String>;
}

pub struct GetTlsTrustOperation;

impl Operation for GetTlsTrustOperation {
    type Input = NoInput;
    type Output = TlsTrustReport;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getTlsTrust",
            method: HttpMethod::Get,
            path: "/api/v1/tls/trust",
            summary: "What trusts the local CA on this machine: the system store and each runtime.",
            is_read_only: true,
            cli_usage: "sendmock trust",
            mcp_tool: "sendmock_tls_trust",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<TlsTrustReport, OperationError> {
        let Some(trust_inspector) = operation_context.machine.trust_inspector.clone() else {
            return Err(OperationError::NotFound {
                message: "This SendMock cannot check the trust stores; run sendmock trust --check"
                    .to_owned(),
            });
        };
        let inspection = tokio::task::spawn_blocking(move || trust_inspector.inspect_trust())
            .await
            .map_err(|join_error| OperationError::Internal(join_error.to_string()))?;
        inspection.map_err(OperationError::Internal)
    }
}

/// A fixed report, for tests and the demo.
pub struct FixedTrustInspector(pub TlsTrustReport);

impl TrustInspector for FixedTrustInspector {
    fn inspect_trust(&self) -> Result<TlsTrustReport, String> {
        Ok(self.0.clone())
    }
}

pub type SharedTrustInspector = Arc<dyn TrustInspector>;
