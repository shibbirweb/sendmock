//! Mailpit's REST API on SendMock's mail (EM-19): the shapes and the requests, with no HTTP.

mod mailpit_mailbox;
mod mailpit_shapes;

pub use mailpit_mailbox::{
    MailpitError, delete_mailpit_messages, delete_mailpit_search, list_mailpit_messages,
    list_mailpit_tags, read_mailpit_headers, read_mailpit_message, read_mailpit_part,
    read_mailpit_source, read_mailpit_view, set_mailpit_read_status, set_mailpit_tags,
};
pub use mailpit_shapes::{
    MailpitAddress, MailpitAttachment, MailpitChecksums, MailpitMessage, MailpitMessageSummary,
    MailpitMessagesSummary,
};
