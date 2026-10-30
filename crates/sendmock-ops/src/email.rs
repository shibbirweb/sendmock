mod change_email_operations;
mod delivery_event_recording;
mod delivery_outcome_runner;
mod email_access;
mod email_detail;
mod email_file_operations;
mod email_inputs;
mod email_search_query;
mod email_summary;
mod email_timeline_entry;
mod list_unsubscribe_report;
mod lookup_operations;
mod lookups;
mod mime_part;
mod native_send_request;
mod out_of_office_reply;
mod read_email_operations;
mod recipient_refusal;
mod send_email_operations;
mod simulate_outcome_operation;

pub use change_email_operations::{
    DeleteAllEmailsOperation, DeleteEmailOperation, UpdateEmailOperation,
};
pub use delivery_outcome_runner::complete_email_intake;
pub use email_detail::{EmailAttachment, EmailDetail, ExtractedData};
pub use email_file_operations::{
    DownloadAttachmentOperation, DownloadRawEmailOperation, GetAttachmentThumbnailOperation,
};
pub use email_summary::{EmailAddress, EmailSummary};
pub use lookup_operations::{GetLinksOperation, GetOtpOperation, WaitForEmailOperation};
pub use read_email_operations::{
    CheckListUnsubscribeOperation, GetEmailMimeOperation, GetEmailOperation,
    GetEmailTimelineOperation, GetLatestEmailOperation, ListEmailsOperation,
};
pub use recipient_refusal::find_recipient_refusal;
pub use send_email_operations::{SendEmailOperation, SendRawEmailOperation};
pub use simulate_outcome_operation::SimulateEmailOutcomeOperation;

use crate::OperationRegistry;

/// Every email operation this build serves.
pub fn register_email_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListEmailsOperation);
    operation_registry.register(DeleteAllEmailsOperation);
    operation_registry.register(GetLatestEmailOperation);
    operation_registry.register(GetEmailOperation);
    operation_registry.register(UpdateEmailOperation);
    operation_registry.register(DeleteEmailOperation);
    operation_registry.register(GetEmailTimelineOperation);
    operation_registry.register(SimulateEmailOutcomeOperation);
    operation_registry.register(CheckListUnsubscribeOperation);
    operation_registry.register(GetEmailMimeOperation);
    operation_registry.register(DownloadRawEmailOperation);
    operation_registry.register(DownloadAttachmentOperation);
    operation_registry.register(GetAttachmentThumbnailOperation);
    operation_registry.register(SendEmailOperation);
    operation_registry.register(SendRawEmailOperation);
    operation_registry.register(GetOtpOperation);
    operation_registry.register(GetLinksOperation);
    operation_registry.register(WaitForEmailOperation);
}
