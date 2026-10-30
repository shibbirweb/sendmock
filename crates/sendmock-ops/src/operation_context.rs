use std::sync::Arc;

use sendmock_core::{Clock, IdGenerator, RandomSource, SystemRandomSource};
use sendmock_mail::EmailIngestService;
use sendmock_store::{
    ActivityStatsRepository, ApiRequestRepository, Database, EmailRepository,
    MessageProviderRepository, MessagingServiceRepository, SavedWebhookDeliveryRepository,
    SettingsRepository, SmsOutcomeRuleRepository, SmsRepository, SmtpSessionRepository,
    VerificationRepository, VerifyServiceRepository, VirtualNumberRepository,
    WebhookDeliveryRepository, WebhookEndpointRepository, WebhookRuleRepository,
    WebhookTemplateRepository, WebhookVariableRepository,
};

use crate::{
    AppSettingsStore, EventBus, InstanceDetails, MediaFetcher, SampleEmailSender,
    StatusCallbackSender, UpdateChecker, WebhookSender,
};

/// The dependencies operations run with, passed in rather than reached through globals.
#[derive(Clone)]
pub struct OperationContext {
    pub database: Arc<Database>,
    pub clock: Arc<dyn Clock>,
    pub id_generator: Arc<dyn IdGenerator>,
    pub instance_details: Arc<InstanceDetails>,
    pub email_repository: EmailRepository,
    pub email_ingest_service: EmailIngestService,
    pub smtp_session_repository: SmtpSessionRepository,
    pub api_request_repository: ApiRequestRepository,
    pub sms_repository: SmsRepository,
    pub sms_outcome_rule_repository: SmsOutcomeRuleRepository,
    pub virtual_number_repository: VirtualNumberRepository,
    pub messaging_service_repository: MessagingServiceRepository,
    pub verify_service_repository: VerifyServiceRepository,
    pub verification_repository: VerificationRepository,
    /// Counts across emails, SMS and verifications for the Overview.
    pub activity_stats_repository: ActivityStatsRepository,
    /// Provider definitions changed from the shipped ones, and custom providers.
    pub message_provider_repository: MessageProviderRepository,
    pub webhook_endpoint_repository: WebhookEndpointRepository,
    /// Delivery attempts; the rows are also the persistent delivery queue.
    pub webhook_delivery_repository: WebhookDeliveryRepository,
    pub webhook_rule_repository: WebhookRuleRepository,
    pub webhook_template_repository: WebhookTemplateRepository,
    pub webhook_variable_repository: WebhookVariableRepository,
    /// Named copies of deliveries, kept through pruning and `reset`.
    pub saved_webhook_delivery_repository: SavedWebhookDeliveryRepository,
    /// Wakes the webhook dispatcher when a delivery is queued.
    pub webhook_dispatch_signal: Arc<tokio::sync::Notify>,
    /// Sends webhook requests; set by the binary, which owns the HTTP client.
    pub webhook_sender: Option<Arc<dyn WebhookSender>>,
    /// Decides random SMS failures; tests pass a seeded one.
    pub random_source: Arc<dyn RandomSource>,
    pub event_bus: EventBus,
    pub settings_store: AppSettingsStore,
    /// Set once the SMTP listener runs, so samples can go through it.
    pub sample_email_sender: Option<Arc<dyn SampleEmailSender>>,
    pub update_checker: UpdateChecker,
    /// Downloads `MediaUrl` links; set by the binary, which owns the HTTP client.
    pub media_fetcher: Option<Arc<dyn MediaFetcher>>,
    /// Calls status callback URLs; set by the binary, which owns the HTTP client.
    pub status_callback_sender: Option<Arc<dyn StatusCallbackSender>>,
}

impl OperationContext {
    /// Builds the repositories and services over one database.
    pub fn new(
        database: Arc<Database>,
        clock: Arc<dyn Clock>,
        id_generator: Arc<dyn IdGenerator>,
        instance_details: InstanceDetails,
    ) -> Self {
        let email_repository = EmailRepository::new(Arc::clone(&database));
        let email_ingest_service = EmailIngestService::new(
            email_repository.clone(),
            Arc::clone(&clock),
            Arc::clone(&id_generator),
        );
        let settings_store = AppSettingsStore::new(SettingsRepository::new(Arc::clone(&database)));
        let sms_repository = SmsRepository::new(Arc::clone(&database));
        let sms_outcome_rule_repository = SmsOutcomeRuleRepository::new(Arc::clone(&database));
        let virtual_number_repository = VirtualNumberRepository::new(Arc::clone(&database));
        let messaging_service_repository = MessagingServiceRepository::new(Arc::clone(&database));
        let verify_service_repository = VerifyServiceRepository::new(Arc::clone(&database));
        let verification_repository = VerificationRepository::new(Arc::clone(&database));
        let message_provider_repository = MessageProviderRepository::new(Arc::clone(&database));
        Self {
            smtp_session_repository: SmtpSessionRepository::new(Arc::clone(&database)),
            api_request_repository: ApiRequestRepository::new(Arc::clone(&database)),
            sms_repository,
            sms_outcome_rule_repository,
            virtual_number_repository,
            messaging_service_repository,
            verify_service_repository,
            verification_repository,
            message_provider_repository,
            activity_stats_repository: ActivityStatsRepository::new(Arc::clone(&database)),
            webhook_endpoint_repository: WebhookEndpointRepository::new(Arc::clone(&database)),
            webhook_delivery_repository: WebhookDeliveryRepository::new(Arc::clone(&database)),
            webhook_rule_repository: WebhookRuleRepository::new(Arc::clone(&database)),
            webhook_template_repository: WebhookTemplateRepository::new(Arc::clone(&database)),
            webhook_variable_repository: WebhookVariableRepository::new(Arc::clone(&database)),
            saved_webhook_delivery_repository: SavedWebhookDeliveryRepository::new(Arc::clone(
                &database,
            )),
            webhook_dispatch_signal: Arc::new(tokio::sync::Notify::new()),
            webhook_sender: None,
            random_source: Arc::new(SystemRandomSource),
            database,
            clock,
            id_generator,
            instance_details: Arc::new(instance_details),
            email_repository,
            email_ingest_service,
            event_bus: EventBus::default(),
            settings_store,
            sample_email_sender: None,
            update_checker: UpdateChecker::default(),
            media_fetcher: None,
            status_callback_sender: None,
        }
    }

    pub fn with_random_source(mut self, random_source: Arc<dyn RandomSource>) -> Self {
        self.random_source = random_source;
        self
    }

    pub fn with_status_callback_sender(
        mut self,
        status_callback_sender: Arc<dyn StatusCallbackSender>,
    ) -> Self {
        self.status_callback_sender = Some(status_callback_sender);
        self
    }

    pub fn with_webhook_sender(mut self, webhook_sender: Arc<dyn WebhookSender>) -> Self {
        self.webhook_sender = Some(webhook_sender);
        self
    }

    pub fn with_media_fetcher(mut self, media_fetcher: Arc<dyn MediaFetcher>) -> Self {
        self.media_fetcher = Some(media_fetcher);
        self
    }

    pub fn with_update_checker(mut self, update_checker: UpdateChecker) -> Self {
        self.update_checker = update_checker;
        self
    }

    pub fn with_sample_email_sender(
        mut self,
        sample_email_sender: Arc<dyn SampleEmailSender>,
    ) -> Self {
        self.sample_email_sender = Some(sample_email_sender);
        self
    }
}
