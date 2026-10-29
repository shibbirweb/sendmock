mod api_request_log_entry;
mod api_request_recording;
mod http_log_operations;
mod log_inputs;
mod smtp_log_operations;
mod smtp_session_log_entry;

pub use api_request_log_entry::{ApiRequestLinkedMessage, ApiRequestLogEntry};
pub use api_request_recording::{CompletedApiRequest, RequestLogSettings, record_api_request};
pub use http_log_operations::{GetApiRequestOperation, ListApiRequestsOperation};
pub use smtp_log_operations::{GetSmtpSessionOperation, ListSmtpSessionsOperation};
pub use smtp_session_log_entry::SmtpSessionLogEntry;

use crate::OperationRegistry;

pub fn register_log_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmtpSessionsOperation);
    operation_registry.register(GetSmtpSessionOperation);
    operation_registry.register(ListApiRequestsOperation);
    operation_registry.register(GetApiRequestOperation);
}
