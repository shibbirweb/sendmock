//! The HTTP catcher: bins, captured requests and the replies SendMock gives.

mod captured_request_operations;
mod http_bin_operations;
mod http_bin_presets;
mod http_capture;
mod http_catcher_views;
mod http_catcher_wire;
mod http_wait_operation;

pub use captured_request_operations::{
    DeleteHttpRequestsOperation, DownloadHttpRequestFileOperation, GetHttpRequestOperation,
    ListHttpRequestsOperation,
};
pub use http_bin_operations::{
    CreateHttpBinOperation, DeleteHttpBinOperation, ListHttpBinsOperation, UpdateHttpBinOperation,
};
pub use http_capture::{CatchAnswer, IncomingHttpRequest, capture_http_request};
pub use http_catcher_wire::{CapturedHttpRequest, HttpBin, HttpMockResponse};
pub use http_wait_operation::WaitForHttpRequestOperation;

use crate::OperationRegistry;

pub fn register_http_catcher_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListHttpBinsOperation);
    operation_registry.register(CreateHttpBinOperation);
    operation_registry.register(UpdateHttpBinOperation);
    operation_registry.register(DeleteHttpBinOperation);
    operation_registry.register(ListHttpRequestsOperation);
    operation_registry.register(DeleteHttpRequestsOperation);
    operation_registry.register(GetHttpRequestOperation);
    operation_registry.register(DownloadHttpRequestFileOperation);
    operation_registry.register(WaitForHttpRequestOperation);
}
