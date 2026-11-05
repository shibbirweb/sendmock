//! SQLite storage: connection setup, migrations and repositories, with queries only and no business rules.

mod activity_stats;
mod api_request;
mod database;
mod database_location;
mod email;
mod email_provider_send;
mod email_response;
mod http_catcher;
mod inbound_route;
mod message_open;
mod message_provider;
mod message_rule;
mod migration;
mod numbers;
mod outcome_rule;
mod payment;
mod payment_definition;
mod payment_provider_object;
mod payment_subscription;
mod saved_webhook_delivery;
mod seed_state;
mod settings;
mod sms;
mod sms_callback_attempt;
mod sms_reply_webhook;
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
pub use email_provider_send::{
    EmailLocalTemplateRecord, EmailLocalTemplateRepository, EmailProviderSendRecord,
    EmailProviderSendRepository,
};
pub use email_response::{EmailResponseRecord, EmailResponseRepository};
pub use http_catcher::{
    CapturedFileRecord, CapturedRequestRecord, CapturedRequestRepository, HttpBinRecord,
    HttpBinRepository,
};
pub use inbound_route::{InboundRouteRecord, InboundRouteRepository};
pub use message_open::{MessageOpenRecord, OpenRecording};
pub use message_provider::{MessageProviderRecord, MessageProviderRepository};
pub use message_rule::{MessageRuleKind, MessageRuleRecord, MessageRuleRepository};
pub use migration::{EMBEDDED_MIGRATIONS, Migration};
pub use numbers::{
    MessagingServiceRecord, MessagingServiceRepository, VirtualNumberRecord,
    VirtualNumberRepository,
};
pub use outcome_rule::{
    EmailOutcomeRuleRecord, EmailOutcomeRuleRepository, RuleMoveDirection, SmsOutcomeRuleRecord,
    SmsOutcomeRuleRepository,
};
pub use payment::{
    PaymentCountColumn, PaymentListFilter, PaymentPage, PaymentRecord, PaymentRepository,
    PaymentTotalsRecord,
};
pub use payment_definition::{PaymentDefinitionRecord, PaymentDefinitionRepository};
pub use payment_provider_object::{PaymentProviderObjectRecord, PaymentProviderObjectRepository};
pub use payment_subscription::{PaymentSubscriptionRecord, PaymentSubscriptionRepository};
pub use saved_webhook_delivery::{SavedWebhookDeliveryRecord, SavedWebhookDeliveryRepository};
pub use seed_state::{SeedStateRecord, SeedStateRepository};
pub use settings::SettingsRepository;
pub use sms::{
    NewSmsRecord, SmsListFilter, SmsMediaContent, SmsMediaRecord, SmsPage, SmsRecord,
    SmsRepository, SmsStatusChangeRecord, SmsThreadRecord,
};
pub use sms_callback_attempt::{
    CallbackAttemptResult, SmsCallbackAttemptRecord, SmsCallbackAttemptRepository,
};
pub use sms_reply_webhook::{SmsReplyWebhookAttemptRecord, SmsReplyWebhookRepository};
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
