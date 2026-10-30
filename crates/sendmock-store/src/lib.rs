//! SQLite storage: connection setup, migrations and repositories, with queries only and no business rules.

mod activity_stats;
mod api_request;
mod database;
mod database_location;
mod email;
mod message_provider;
mod migration;
mod numbers;
mod outcome_rule;
mod saved_webhook_delivery;
mod settings;
mod sms;
mod smtp_session;
mod store_error;
mod verify;
mod webhook_delivery;
mod webhook_endpoint;
mod webhook_rule;
mod webhook_template;
mod webhook_variable;

pub use activity_stats::{
    ActivityStatsRepository, HourlyActivityRecord, HourlyCountRecord, MessageTotalsRecord,
};
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
pub use outcome_rule::{
    EmailOutcomeRuleRecord, EmailOutcomeRuleRepository, RuleMoveDirection, SmsOutcomeRuleRecord,
    SmsOutcomeRuleRepository,
};
pub use saved_webhook_delivery::{SavedWebhookDeliveryRecord, SavedWebhookDeliveryRepository};
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
pub use webhook_delivery::{
    DeliveryAttemptResult, DeliveryOutcomeFilter, DeliveryOutcomeRecord, WebhookDeliveryFilter,
    WebhookDeliveryPage, WebhookDeliveryRecord, WebhookDeliveryRepository,
};
pub use webhook_endpoint::{
    WebhookEndpointRecord, WebhookEndpointRepository, WebhookSecretRotation,
};
pub use webhook_rule::{WebhookRuleRecord, WebhookRuleRepository};
pub use webhook_template::{
    WebhookTemplateRecord, WebhookTemplateRepository, WebhookTemplateRevisionRecord,
};
pub use webhook_variable::{WebhookVariableRecord, WebhookVariableRepository};
