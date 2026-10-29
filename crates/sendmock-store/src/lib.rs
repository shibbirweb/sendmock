//! SQLite storage: connection setup, migrations and repositories, with queries only and no business rules.

mod api_request;
mod database;
mod database_location;
mod email;
mod message_provider;
mod migration;
mod numbers;
mod outcome_rule;
mod settings;
mod sms;
mod smtp_session;
mod store_error;
mod verify;

pub use api_request::{ApiRequestFilter, ApiRequestPage, ApiRequestRecord, ApiRequestRepository};
pub use database::Database;
pub use database_location::DatabaseLocation;
pub use email::{
    AttachmentRecord, EmailListFilter, EmailPage, EmailRecord, EmailRepository,
    NewAttachmentRecord, NewEmailRecord, StoredEmailAddress, TimelineRecord,
};
pub use message_provider::{MessageProviderRecord, MessageProviderRepository};
pub use migration::{EMBEDDED_MIGRATIONS, Migration};
pub use numbers::{
    MessagingServiceRecord, MessagingServiceRepository, VirtualNumberRecord,
    VirtualNumberRepository,
};
pub use outcome_rule::{RuleMoveDirection, SmsOutcomeRuleRecord, SmsOutcomeRuleRepository};
pub use settings::SettingsRepository;
pub use sms::{
    NewSmsRecord, SmsCallbackAttemptRecord, SmsListFilter, SmsMediaContent, SmsMediaRecord,
    SmsPage, SmsRecord, SmsRepository, SmsStatusChangeRecord, SmsThreadRecord,
};
pub use smtp_session::{
    SmtpSessionFilter, SmtpSessionPage, SmtpSessionRecord, SmtpSessionRepository,
};
pub use store_error::StoreError;
pub use verify::{
    VerificationFilter, VerificationPage, VerificationRecord, VerificationRepository,
    VerificationTimelineRecord, VerifyServiceRecord, VerifyServiceRepository,
};
