use std::sync::Arc;

use sendmock_core::{Clock, IdGenerator, RandomSource, SystemRandomSource};
use sendmock_mail::EmailIngestService;
use sendmock_store::{
    ApiRequestRepository, Database, EmailRepository, SettingsRepository, SmsOutcomeRuleRepository,
    SmsRepository, SmtpSessionRepository,
};

use crate::{
    AppSettingsStore, EventBus, InstanceDetails, MediaFetcher, SampleEmailSender,
    StatusCallbackSender, UpdateChecker,
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
        let smtp_session_repository = SmtpSessionRepository::new(Arc::clone(&database));
        let api_request_repository = ApiRequestRepository::new(Arc::clone(&database));
        let settings_store = AppSettingsStore::new(SettingsRepository::new(Arc::clone(&database)));
        let sms_repository = SmsRepository::new(Arc::clone(&database));
        let sms_outcome_rule_repository = SmsOutcomeRuleRepository::new(Arc::clone(&database));
        Self {
            smtp_session_repository,
            api_request_repository,
            sms_repository,
            sms_outcome_rule_repository,
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
