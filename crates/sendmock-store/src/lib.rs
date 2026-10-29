//! SQLite storage: connection setup, migrations and repositories, with queries only and no business rules.

mod api_request;
mod database;
mod database_location;
mod email;
mod migration;
mod settings;
mod smtp_session;
mod store_error;

pub use api_request::{ApiRequestFilter, ApiRequestPage, ApiRequestRecord, ApiRequestRepository};
pub use database::Database;
pub use database_location::DatabaseLocation;
pub use email::{
    AttachmentRecord, EmailListFilter, EmailPage, EmailRecord, EmailRepository,
    NewAttachmentRecord, NewEmailRecord, StoredEmailAddress, TimelineRecord,
};
pub use migration::{EMBEDDED_MIGRATIONS, Migration};
pub use settings::SettingsRepository;
pub use smtp_session::{
    SmtpSessionFilter, SmtpSessionPage, SmtpSessionRecord, SmtpSessionRepository,
};
pub use store_error::StoreError;
