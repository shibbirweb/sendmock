mod media_fetcher;
mod sms_change_operations;
mod sms_detail;
mod sms_ingest;
mod sms_inputs;
mod sms_lookups;
mod sms_media_intake;
mod sms_read_operations;
mod sms_send_operations;
mod sms_views;

pub use media_fetcher::{FetchedMedia, MediaFetcher};
pub use sms_change_operations::{
    DeleteAllSmsOperation, DeleteSmsOperation, SetSmsStatusOperation, apply_status_change,
};
pub use sms_detail::SmsMessageDetail;
pub use sms_ingest::{IncomingSms, store_sms};
pub use sms_lookups::{describe_sms_code, find_newest_sms_with_code};
pub use sms_read_operations::{
    DownloadSmsMediaOperation, GetSmsOperation, ListSmsOperation, ListSmsThreadsOperation,
    WaitForSmsOperation,
};
pub use sms_send_operations::{SendSmsOperation, SimulateInboundSmsOperation};
pub use sms_views::{SmsMessage, SmsThread};

use crate::OperationRegistry;

/// Every SMS operation this build serves.
pub fn register_sms_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmsOperation);
    operation_registry.register(DeleteAllSmsOperation);
    operation_registry.register(SendSmsOperation);
    operation_registry.register(ListSmsThreadsOperation);
    operation_registry.register(GetSmsOperation);
    operation_registry.register(DeleteSmsOperation);
    operation_registry.register(DownloadSmsMediaOperation);
    operation_registry.register(SetSmsStatusOperation);
    operation_registry.register(SimulateInboundSmsOperation);
    operation_registry.register(WaitForSmsOperation);
}
