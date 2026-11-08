//! The operation registry: each feature is one operation that REST, the CLI and MCP all call.

pub mod ai;
mod bkash;
mod custom_gateways;
mod demo;
mod email;
mod events;
mod http_catcher;
mod inbound_routes;
mod input_coercion;
mod input_shape;
mod instance_details;
mod integrations;
mod logs;
mod message_providers;
mod message_rules;
mod no_input;
mod nullable_schema;
mod numbers;
mod opens;
mod operation;
mod operation_answer;
mod operation_context;
mod operation_error;
mod operation_registry;
mod outcome_rules;
mod paddle;
mod page_of;
mod payments;
mod paypal;
mod pop3_mailbox;
mod present_value;
mod projects;
mod providers;
mod push;
mod razorpay;
mod request_client;
mod request_scope;
mod samples;
mod scenarios;
mod seed;
mod settings;
mod sms;
mod sms_replies;
mod smtp_chaos;
mod smtp_delivery;
mod sslcommerz;
mod stripe;
mod subscriptions;
mod system;
mod updates;
mod verify;
mod webhooks;

pub use demo::{DemoDataError, DemoLoadOutcome, load_demo_data};
pub use email::mailpit;
pub use email::{
    EmailAddress, EmailAttachment, EmailDetail, EmailNetworkClients, EmailRelay, EmailSummary,
    ExtractedData, LinkChecker, LinkProbe, RelayMessage, SpamChecker, SpamdReport, SpamdRule,
    complete_email_intake, find_recipient_refusal,
};
pub use events::{
    AppEvent, AppEventType, EventBus, GetRecentEventsOperation, RecentEventFilter,
    RecentEventsInput, RecordedEvent, publish_email_deleted, publish_email_inbound,
    publish_email_received, publish_event,
};
pub use http_catcher::{
    CapturedHttpRequest, CatchAnswer, HttpBin, HttpMockResponse, IncomingHttpRequest,
    capture_http_request,
};
pub use inbound_routes::{InboundRoute, InboundRouteAction, InboundRouteFilter};
pub use input_coercion::build_input_from_text;
pub use input_shape::{InputShape, ScalarType, accepts_null, describe_input_shape};
pub use instance_details::{InstanceDetails, ReleaseChannel};
pub use integrations::{GetIntegrationOperation, IntegrationSnippet};
pub use logs::{
    ApiRequestLinkedMessage, ApiRequestLogEntry, CompletedApiRequest, ProviderRequestLogEntry,
    RequestLogSettings, SmtpSessionLogEntry, record_api_request, record_provider_request,
};
pub use message_providers::{
    MessageProviderInput, MessageProviderPreview, MessageProviderView, ProviderCredentialReveal,
    ProviderSampleRequest, WhatsappWebhookVerification, WhatsappWebhookVerificationRequest,
    mask_secret_value,
};
pub use message_rules::{ForwardRule, TagRule};
pub use no_input::NoInput;
pub(crate) use nullable_schema::nullable_schema;
pub use numbers::{MessagingService, VirtualNumber};
pub use opens::{OpenRecord, OpenSource};
pub use operation::{
    AnswerKind, CliArgument, HttpMethod, Operation, OperationDefinition, OperationSelector,
    RawBodyInput, SelectorChoice, SuccessStatus, to_snake_case,
};
pub use operation_answer::{FileAnswer, NoContent, OperationAnswer};
pub use operation_context::OperationContext;
pub use operation_error::OperationError;
pub use operation_registry::{ErasedOperation, OperationRegistry};
pub use outcome_rules::{
    EmailOutcomeRule, OutcomeTestResult, SmsOutcomeRule, load_email_outcome_rules,
};
pub use page_of::PageOf;
pub use payments::{
    PaymentDetail, PaymentFlowDefinition, PaymentFlowStep, PaymentGatewayDefinition,
    PaymentMethodDefinition, PaymentSummary,
};
pub use pop3_mailbox::{
    POP3_MAILBOX_SIZE, Pop3MailboxMessage, delete_pop3_messages, open_pop3_mailbox,
    read_pop3_message,
};
pub use projects::{PROJECT_HEADER, Project, find_named_project};
pub use providers::{
    MessageProviderDefinition, ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome,
    ProviderRoute, answer_provider_request, builtin_email_providers, builtin_sms_providers,
    find_whatsapp_media_download, load_sms_provider_definitions, sign_twilio_request,
};
pub use push::{PushFilterQuery, PushListQuery, PushNotification, PushReference, PushWaitQuery};
pub use request_client::{REQUEST_CLIENT_HEADER, RequestClient};
pub use request_scope::RequestScope;
pub use samples::{CreateSampleOperation, CreatedSample, SampleEmail, SampleEmailSender};
pub use seed::{
    ApplySeedOperation, EnvironmentReader, ExportSeedOperation, FixedEnvironment,
    GetSeedStatusOperation, ProcessEnvironment, SeedChangedItem, SeedFileRequest, SeedItemChange,
    SeedItemCount, SeedStatus, SeedValidation, SeedValidationError, ValidateSeedOperation,
    apply_seed_toml, restore_seed_state, validate_seed_toml,
};
pub use settings::{
    AppSettings, AppSettingsStore, AppSettingsUpdate, EmailOutcomeProfile, SmsSimulationProfile,
    UpdateCheckMode, build_ingest_options, list_unbounded_traffic, prune_traffic,
    read_ingest_options,
};
pub use sms::{
    FetchedMedia, HttpCallResult, IncomingSms, MediaFetcher, RecordedHttpRequest,
    RecordedHttpResponse, ReplyWebhookOutcome, ReplyWebhookSender, ReplyWebhookTargetName,
    SmsMessage, SmsMessageDetail, SmsReplyWebhookAttempt, SmsReplyWebhookResult, SmsThread,
    StatusCallbackSender, TwimlMethodName, TwimlVerbView, apply_status_change,
    decide_outbound_send, describe_rejection, describe_sms_code, find_newest_sms_with_code,
    load_custom_outcome_rules, run_due_status_callbacks, run_status_callback_dispatcher,
    start_sms_delivery, store_sms, to_simulation_profile,
};
pub use sms_replies::{
    MAXIMUM_TWIML_FETCHES, ReplyWebhookTarget, ReplyWebhookTargetKind, TWILIO_INBOUND_TEMPLATE_ID,
    resolve_reply_webhook_target, run_reply_webhook, start_reply_webhook,
};
pub use smtp_chaos::{SmtpChaos, read_smtp_chaos, take_chaos_rejection};
pub use smtp_delivery::{SmtpMessage, record_smtp_session, store_smtp_message};
pub use system::{
    ActivityBucket, AppInfo, AppStats, CurrencyAmount, GetHealthOperation, GetInfoOperation,
    GetStatsOperation, HealthStatus,
};
pub use updates::{
    AvailableRelease, GetUpdatesOperation, InstallMethod, PublishedRelease, ReleaseSource,
    UpdateCheckResult, UpdateChecker,
};
pub use verify::{Verification, VerificationDetail, VerifyService, find_newest_verification};
pub use webhooks::{
    DeliveryOrder, DeliveryTrigger, EndpointPreviewResult, FileTemplateLibrary,
    LoadedTemplateDirectory, ResolvedVariables, RevealedEndpointSecret, SavedDelivery,
    TemplateRenderResult, TemplateRevision, VariablePreviewResult, WebhookDelivery,
    WebhookDeliveryDetail, WebhookEndpoint, WebhookRule, WebhookSendFailure, WebhookSendResult,
    WebhookSender, WebhookTemplateDetail, WebhookTemplateSummary, WebhookVariable,
    build_event_template_context, build_sample_template_context, enqueue_webhook_delivery,
    fire_matching_rules, load_template_directory, read_environment_variables,
    resolve_template_variables, run_due_deliveries, run_webhook_dispatcher,
    run_webhook_rule_subscriber,
};

/// Every operation this build of SendMock serves.
pub fn build_operation_registry() -> OperationRegistry {
    let mut operation_registry = OperationRegistry::default();
    operation_registry.register(GetHealthOperation);
    operation_registry.register(GetInfoOperation);
    operation_registry.register(GetSeedStatusOperation);
    operation_registry.register(ExportSeedOperation);
    operation_registry.register(ValidateSeedOperation);
    operation_registry.register(ApplySeedOperation);
    operation_registry.register(GetStatsOperation);
    email::register_email_operations(&mut operation_registry);
    events::register_event_operations(&mut operation_registry);
    sms::register_sms_operations(&mut operation_registry);
    sms_replies::register_sms_reply_operations(&mut operation_registry);
    payments::register_payment_operations(&mut operation_registry);
    outcome_rules::register_outcome_rule_operations(&mut operation_registry);
    message_rules::register_message_rule_operations(&mut operation_registry);
    projects::register_project_operations(&mut operation_registry);
    push::register_push_operations(&mut operation_registry);
    inbound_routes::register_inbound_route_operations(&mut operation_registry);
    http_catcher::register_http_catcher_operations(&mut operation_registry);
    scenarios::register_scenario_operations(&mut operation_registry);
    subscriptions::register_subscription_operations(&mut operation_registry);
    ai::register_ai_operations(&mut operation_registry);
    numbers::register_number_operations(&mut operation_registry);
    verify::register_verify_operations(&mut operation_registry);
    message_providers::register_sms_provider_operations(&mut operation_registry);
    webhooks::register_webhook_operations(&mut operation_registry);
    logs::register_log_operations(&mut operation_registry);
    settings::register_settings_operations(&mut operation_registry);
    operation_registry.register(CreateSampleOperation);
    operation_registry.register(GetIntegrationOperation);
    operation_registry.register(GetUpdatesOperation);
    operation_registry
}
