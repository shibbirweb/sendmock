mod change_email_operations;
mod delivery_event_recording;
mod delivery_outcome_runner;
mod email_access;
mod email_check_operations;
mod email_click_operations;
mod email_detail;
mod email_file_operations;
mod email_inputs;
mod email_network_clients;
mod email_open_operations;
mod email_relay;
mod email_release;
mod email_response_links;
mod email_response_operations;
mod email_response_store;
mod email_search_query;
mod email_summary;
mod email_timeline_entry;
mod inbound_email_operation;
mod inbound_email_store;
mod link_check_operation;
mod link_checker;
mod list_unsubscribe_report;
mod lookup_operations;
mod lookups;
pub mod mailpit;
mod mime_part;
mod native_send_request;
mod out_of_office_reply;
mod read_email_operations;
mod recipient_refusal;
mod release_email_operation;
mod response_text;
mod send_email_operations;
mod simulate_outcome_operation;
mod spam_check_operation;
mod spam_checker;

pub use change_email_operations::{
    DeleteAllEmailsOperation, DeleteEmailOperation, UpdateEmailOperation,
};
pub use delivery_outcome_runner::complete_email_intake;
pub(crate) use email_access::read_wait_duration;
pub use email_check_operations::CheckEmailHtmlOperation;
pub use email_click_operations::{ListEmailClicksOperation, RecordEmailClickOperation};
pub use email_detail::{EmailAttachment, EmailDetail, ExtractedData};
pub(crate) use email_file_operations::read_raw_message;
pub use email_file_operations::{
    DownloadAttachmentOperation, DownloadMimePartOperation, DownloadRawEmailOperation,
    GetAttachmentThumbnailOperation,
};
pub use email_network_clients::EmailNetworkClients;
pub use email_open_operations::{ListEmailOpensOperation, RecordEmailOpenOperation};
pub use email_relay::{EmailRelay, RelayMessage};
pub(crate) use email_release::{is_on_allowlist, release_email};
pub use email_response_operations::{ForwardEmailOperation, ReplyToEmailOperation};
pub use email_summary::{EmailAddress, EmailSummary};
pub use inbound_email_operation::ReceiveInboundEmailOperation;
pub use link_check_operation::CheckEmailLinksOperation;
pub use link_checker::{LinkChecker, LinkProbe};
pub use lookup_operations::{GetLinksOperation, GetOtpOperation, WaitForEmailOperation};
pub(crate) use native_send_request::{NativeSendAttachment, NativeSendRequest, read_bare_address};
pub use read_email_operations::{
    CheckListUnsubscribeOperation, GetEmailMimeOperation, GetEmailOperation,
    GetEmailTimelineOperation, GetLatestEmailOperation, ListEmailsOperation,
};
pub use recipient_refusal::find_recipient_refusal;
pub use release_email_operation::ReleaseEmailOperation;
pub use send_email_operations::{SendEmailOperation, SendRawEmailOperation};
pub use simulate_outcome_operation::SimulateEmailOutcomeOperation;
pub use spam_check_operation::CheckEmailSpamOperation;
pub use spam_checker::{SpamChecker, SpamdReport, SpamdRule};

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
    operation_registry.register(RecordEmailOpenOperation);
    operation_registry.register(ListEmailOpensOperation);
    operation_registry.register(RecordEmailClickOperation);
    operation_registry.register(ListEmailClicksOperation);
    operation_registry.register(CheckListUnsubscribeOperation);
    operation_registry.register(CheckEmailHtmlOperation);
    operation_registry.register(CheckEmailLinksOperation);
    operation_registry.register(CheckEmailSpamOperation);
    operation_registry.register(ReleaseEmailOperation);
    operation_registry.register(ReplyToEmailOperation);
    operation_registry.register(ForwardEmailOperation);
    operation_registry.register(ReceiveInboundEmailOperation);
    operation_registry.register(GetEmailMimeOperation);
    operation_registry.register(DownloadRawEmailOperation);
    operation_registry.register(DownloadMimePartOperation);
    operation_registry.register(DownloadAttachmentOperation);
    operation_registry.register(GetAttachmentThumbnailOperation);
    operation_registry.register(SendEmailOperation);
    operation_registry.register(SendRawEmailOperation);
    operation_registry.register(GetOtpOperation);
    operation_registry.register(GetLinksOperation);
    operation_registry.register(WaitForEmailOperation);
}
