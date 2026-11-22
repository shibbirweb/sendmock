use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

/// SendMock's local CA, to trust for the HTTPS provider port.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TlsCertificateAuthority {
    /// Where the CA certificate is on this machine.
    pub path: String,
    /// The CA certificate (PEM), to add to a trust store or `NODE_EXTRA_CA_CERTS`.
    pub pem: String,
    /// The provider APIs over HTTPS.
    pub provider_tls_address: String,
}

pub struct GetTlsCaOperation;

impl Operation for GetTlsCaOperation {
    type Input = NoInput;
    type Output = TlsCertificateAuthority;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getTlsCa",
            method: HttpMethod::Get,
            path: "/api/v1/tls/ca",
            summary: "The local CA to trust for the HTTPS provider port.",
            is_read_only: true,
            cli_usage: "sendmock tls ca",
            mcp_tool: "sendmock_tls_ca",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Not found while the provider APIs are not served over HTTPS, or use your own certificate.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<TlsCertificateAuthority, OperationError> {
        let provider_tls = operation_context.instance_details.provider_tls.as_ref();
        match provider_tls.and_then(|provider_tls| {
            provider_tls
                .ca_certificate_path
                .clone()
                .zip(provider_tls.ca_certificate_pem.clone())
                .map(|(path, pem)| (path, pem, provider_tls.address.clone()))
        }) {
            Some((path, pem, provider_tls_address)) => Ok(TlsCertificateAuthority {
                path,
                pem,
                provider_tls_address,
            }),
            None => Err(OperationError::NotFound {
                message: "SendMock has no local CA: start it with --provider-tls-addr and no --provider-tls-cert".to_owned(),
            }),
        }
    }
}
