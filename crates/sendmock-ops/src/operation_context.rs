use std::sync::Arc;

use sendmock_core::{Clock, IdGenerator, RandomSource, SystemRandomSource};
use sendmock_mail::EmailIngestService;
use sendmock_store::{
    ActivityStatsRepository, ApiRequestRepository, CapturedRequestRepository, Database,
    EmailLocalTemplateRepository, EmailOutcomeRuleRepository, EmailProviderSendRepository,
    EmailRepository, EmailResponseRepository, HttpBinRepository, InboundRouteRepository,
    MessageProviderRepository, MessageRuleKind, MessageRuleRepository, MessagingServiceRepository,
    PaymentDefinitionRepository, PaymentProviderObjectRepository, PaymentRepository,
    PaymentSubscriptionRepository, ProjectRepository, PushNotificationRepository,
    SavedWebhookDeliveryRepository, SeedStateRepository, SettingsRepository,
    SmsCallbackAttemptRepository, SmsOutcomeRuleRepository, SmsReplyWebhookRepository,
    SmsRepository, SmtpSessionRepository, TrafficPruner, VerificationRepository,
    VerifyServiceRepository, VirtualNumberRepository, WebhookDeliveryRepository,
    WebhookEndpointRepository, WebhookRuleRepository, WebhookTemplateRepository,
    WebhookVariableRepository,
};

use crate::{
    AppSettingsStore, EnvironmentReader, EventBus, InstanceDetails, MediaFetcher,
    ProcessEnvironment, ReplyWebhookSender, SampleEmailSender, StatusCallbackSender, UpdateChecker,
    WebhookSender,
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
    pub email_outcome_rule_repository: EmailOutcomeRuleRepository,
    /// The Logs screen's SMTP sessions and API requests.
    pub logs: LogStores,
    pub sms_repository: SmsRepository,
    /// Status callback attempts; the rows are also the callback retry queue.
    pub sms_callback_attempt_repository: SmsCallbackAttemptRepository,
    /// Reply webhook calls of inbound messages and their latest outcome.
    pub sms_reply_webhook_repository: SmsReplyWebhookRepository,
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
    pub dispatch_signals: DispatchSignals,
    pub http_catcher_stores: HttpCatcherStores,
    /// Sends webhook requests; set by the binary, which owns the HTTP client.
    pub webhook_sender: Option<Arc<dyn WebhookSender>>,
    /// Decides random SMS failures; tests pass a seeded one.
    pub random_source: Arc<dyn RandomSource>,
    pub event_bus: EventBus,
    pub settings_store: AppSettingsStore,
    pub traffic_pruner: TrafficPruner,
    /// Set once the SMTP listener runs, so samples can go through it.
    pub sample_email_sender: Option<Arc<dyn SampleEmailSender>>,
    pub update_checker: UpdateChecker,
    /// Templates from `--templates-dir`, replaced when the directory changes.
    pub file_templates: crate::webhooks::FileTemplateLibrary,
    /// Downloads `MediaUrl` links; set by the binary, which owns the HTTP client.
    pub media_fetcher: Option<Arc<dyn MediaFetcher>>,
    pub email_network_clients: crate::email::EmailNetworkClients,
    /// Calls status callback URLs; set by the binary, which owns the HTTP client.
    pub status_callback_sender: Option<Arc<dyn StatusCallbackSender>>,
    /// Calls reply webhook URLs and fetches TwiML; set by the binary, which owns the HTTP client.
    pub reply_webhook_sender: Option<Arc<dyn ReplyWebhookSender>>,
    /// The seed file applied last, for reset and seed status.
    pub seed_state_repository: SeedStateRepository,
    /// Edited built-in and custom payment flows, methods and gateways.
    pub payment_definition_repository: PaymentDefinitionRepository,
    pub payment_repository: PaymentRepository,
    pub payment_stores: PaymentStores,
    pub email_stores: EmailStores,
    /// Reads `${ENV_VAR}` references in seed files; tests pass fixed values.
    pub environment_reader: Arc<dyn EnvironmentReader>,
    pub project_repository: ProjectRepository,
    pub push_notifications: PushNotificationRepository,
    /// Who sent this request and the project its traffic goes to.
    pub request: crate::RequestScope,
}

/// Wake the background dispatchers when work is queued.
#[derive(Clone, Default)]
pub struct DispatchSignals {
    /// A webhook delivery was queued.
    pub webhooks: Arc<tokio::sync::Notify>,
    /// A status callback retry was scheduled.
    pub status_callbacks: Arc<tokio::sync::Notify>,
}

/// What payments keep beside the payments themselves.
#[derive(Clone)]
pub struct PaymentStores {
    /// Provider adapters' own objects beside payments, such as Stripe refunds.
    pub provider_objects: PaymentProviderObjectRepository,
    pub subscriptions: PaymentSubscriptionRepository,
}

impl PaymentStores {
    fn new(database: &Arc<Database>) -> Self {
        Self {
            provider_objects: PaymentProviderObjectRepository::new(Arc::clone(database)),
            subscriptions: PaymentSubscriptionRepository::new(Arc::clone(database)),
        }
    }
}

/// What the Logs screen reads: each SMTP session's transcript and each API request.
#[derive(Clone)]
pub struct LogStores {
    pub smtp_sessions: SmtpSessionRepository,
    pub api_requests: ApiRequestRepository,
}

impl LogStores {
    fn new(database: &Arc<Database>) -> Self {
        Self {
            smtp_sessions: SmtpSessionRepository::new(Arc::clone(database)),
            api_requests: ApiRequestRepository::new(Arc::clone(database)),
        }
    }
}

/// The HTTP catcher's bins and the requests captured in them.
#[derive(Clone)]
pub struct HttpCatcherStores {
    pub bins: HttpBinRepository,
    pub requests: CapturedRequestRepository,
}

impl HttpCatcherStores {
    fn new(database: &Arc<Database>) -> Self {
        Self {
            bins: HttpBinRepository::new(Arc::clone(database)),
            requests: CapturedRequestRepository::new(Arc::clone(database)),
        }
    }
}

/// What emails keep beside the messages: each send as its provider knows it, the seed file's
/// local stand-ins for provider templates, the tag and forward rules run on arrival, and the
/// links between simulated replies and their originals.
#[derive(Clone)]
pub struct EmailStores {
    pub sends: EmailProviderSendRepository,
    pub local_templates: EmailLocalTemplateRepository,
    pub tag_rules: MessageRuleRepository,
    pub forward_rules: MessageRuleRepository,
    /// Which emails are simulated replies or forwards, and of what.
    pub responses: EmailResponseRepository,
    pub inbound_routes: InboundRouteRepository,
}

impl EmailStores {
    fn new(database: &Arc<Database>) -> Self {
        Self {
            sends: EmailProviderSendRepository::new(Arc::clone(database)),
            local_templates: EmailLocalTemplateRepository::new(Arc::clone(database)),
            tag_rules: MessageRuleRepository::new(Arc::clone(database), MessageRuleKind::Tag),
            forward_rules: MessageRuleRepository::new(
                Arc::clone(database),
                MessageRuleKind::Forward,
            ),
            responses: EmailResponseRepository::new(Arc::clone(database)),
            inbound_routes: InboundRouteRepository::new(Arc::clone(database)),
        }
    }
}

impl OperationContext {
    /// Builds the repositories and services over one database.
    pub fn new(
        database: Arc<Database>,
        clock: Arc<dyn Clock>,
        id_generator: Arc<dyn IdGenerator>,
        instance_details: InstanceDetails,
    ) -> Self {
        let share_database = || Arc::clone(&database);
        Self {
            email_repository: EmailRepository::new(share_database()),
            settings_store: AppSettingsStore::new(SettingsRepository::new(share_database())),
            traffic_pruner: TrafficPruner::new(share_database()),
            email_outcome_rule_repository: EmailOutcomeRuleRepository::new(share_database()),
            logs: LogStores::new(&database),
            push_notifications: PushNotificationRepository::new(share_database()),
            sms_repository: SmsRepository::new(share_database()),
            seed_state_repository: SeedStateRepository::new(share_database()),
            payment_definition_repository: PaymentDefinitionRepository::new(share_database()),
            payment_repository: PaymentRepository::new(share_database()),
            payment_stores: PaymentStores::new(&database),
            email_stores: EmailStores::new(&database),
            sms_callback_attempt_repository: SmsCallbackAttemptRepository::new(share_database()),
            sms_reply_webhook_repository: SmsReplyWebhookRepository::new(share_database()),
            sms_outcome_rule_repository: SmsOutcomeRuleRepository::new(share_database()),
            virtual_number_repository: VirtualNumberRepository::new(share_database()),
            messaging_service_repository: MessagingServiceRepository::new(share_database()),
            verify_service_repository: VerifyServiceRepository::new(share_database()),
            verification_repository: VerificationRepository::new(share_database()),
            message_provider_repository: MessageProviderRepository::new(share_database()),
            activity_stats_repository: ActivityStatsRepository::new(share_database()),
            webhook_endpoint_repository: WebhookEndpointRepository::new(share_database()),
            webhook_delivery_repository: WebhookDeliveryRepository::new(share_database()),
            webhook_rule_repository: WebhookRuleRepository::new(share_database()),
            webhook_template_repository: WebhookTemplateRepository::new(share_database()),
            webhook_variable_repository: WebhookVariableRepository::new(share_database()),
            saved_webhook_delivery_repository: SavedWebhookDeliveryRepository::new(share_database()),
            dispatch_signals: DispatchSignals::default(),
            http_catcher_stores: HttpCatcherStores::new(&database),
            project_repository: ProjectRepository::new(share_database()),
            request: crate::RequestScope::default(),
            webhook_sender: None,
            random_source: Arc::new(SystemRandomSource),
            email_ingest_service: build_email_ingest_service(&database, &clock, &id_generator),
            database,
            clock,
            id_generator,
            instance_details: Arc::new(instance_details),
            event_bus: EventBus::default(),
            sample_email_sender: None,
            update_checker: UpdateChecker::default(),
            file_templates: crate::webhooks::FileTemplateLibrary::default(),
            media_fetcher: None,
            email_network_clients: crate::email::EmailNetworkClients::default(),
            status_callback_sender: None,
            reply_webhook_sender: None,
            environment_reader: Arc::new(ProcessEnvironment),
        }
    }

    /// The same context for one request from this client.
    pub fn with_request_client(mut self, request_client: crate::RequestClient) -> Self {
        self.request.client = request_client;
        self
    }

    /// The same context for a request that names its project; the caller checks it exists.
    pub fn with_project_key(mut self, project_key: &str) -> Self {
        project_key.clone_into(&mut self.request.project_key);
        self
    }

    pub fn with_environment_reader(
        mut self,
        environment_reader: Arc<dyn EnvironmentReader>,
    ) -> Self {
        self.environment_reader = environment_reader;
        self
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

    pub fn with_reply_webhook_sender(
        mut self,
        reply_webhook_sender: Arc<dyn ReplyWebhookSender>,
    ) -> Self {
        self.reply_webhook_sender = Some(reply_webhook_sender);
        self
    }

    pub fn with_webhook_sender(mut self, webhook_sender: Arc<dyn WebhookSender>) -> Self {
        self.webhook_sender = Some(webhook_sender);
        self
    }

    pub fn with_link_checker(mut self, link_checker: Arc<dyn crate::email::LinkChecker>) -> Self {
        self.email_network_clients.link_checker = Some(link_checker);
        self
    }

    pub fn with_email_relay(mut self, email_relay: Arc<dyn crate::email::EmailRelay>) -> Self {
        self.email_network_clients.relay = Some(email_relay);
        self
    }

    pub fn with_spam_checker(mut self, spam_checker: Arc<dyn crate::email::SpamChecker>) -> Self {
        self.email_network_clients.spam_checker = Some(spam_checker);
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

fn build_email_ingest_service(
    database: &Arc<Database>,
    clock: &Arc<dyn Clock>,
    id_generator: &Arc<dyn IdGenerator>,
) -> EmailIngestService {
    EmailIngestService::new(
        EmailRepository::new(Arc::clone(database)),
        Arc::clone(clock),
        Arc::clone(id_generator),
    )
}
