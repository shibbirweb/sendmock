use std::sync::Arc;

use sendmock_ops::OperationContext;
use sendmock_smtp::RelaySmtpClient;

use crate::http_link_checker::with_http_link_checker;
use crate::spamd_client::with_spamd_client;

/// The context with what email features use to reach outside SendMock: the link checker,
/// the spamd client and the relay SMTP client.
pub fn with_email_network_clients(operation_context: OperationContext) -> OperationContext {
    let operation_context = with_spamd_client(with_http_link_checker(operation_context));
    match RelaySmtpClient::with_platform_roots() {
        Ok(relay_client) => operation_context.with_email_relay(Arc::new(relay_client)),
        Err(tls_error) => {
            tracing::warn!(error = %tls_error, "release is off: the system's TLS roots could not be read");
            operation_context
        }
    }
}
