mod email_delivery_outcome;
mod email_list_filter;
mod email_reader;
mod email_record;
mod email_repository;
mod email_row_mapping;

pub use email_list_filter::EmailListFilter;
pub use email_record::{
    AttachmentRecord, EmailPage, EmailRecord, NewAttachmentRecord, NewEmailRecord,
    StoredEmailAddress, TimelineRecord,
};
pub use email_repository::EmailRepository;
