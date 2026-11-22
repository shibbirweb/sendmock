mod mailgun_complaint_operations;
mod mailgun_complaint_recording;
mod mailgun_complaints_api;
mod mailgun_domain_api;
mod mailgun_event_items;
mod mailgun_events_api;

pub use mailgun_complaint_operations::{
    ClearMailgunComplaintsOperation, ListMailgunComplaintsOperation, MailgunComplaint,
};
pub(crate) use mailgun_complaint_recording::{
    record_mailgun_complaint, suppress_complained_recipients,
};
pub(crate) use mailgun_domain_api::answer_mailgun_domain_request;

use crate::OperationRegistry;

/// Every Mailgun complaint operation this build serves.
pub fn register_mailgun_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListMailgunComplaintsOperation);
    operation_registry.register(ClearMailgunComplaintsOperation);
}
