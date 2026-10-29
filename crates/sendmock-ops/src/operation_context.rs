use std::sync::Arc;

use sendmock_core::{Clock, IdGenerator};
use sendmock_mail::EmailIngestService;
use sendmock_store::{
    ApiRequestRepository, Database, EmailRepository, SettingsRepository, SmtpSessionRepository,
};

use crate::{AppSettingsStore, EventBus, InstanceDetails, SampleEmailSender, UpdateChecker};

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
    pub event_bus: EventBus,
    pub settings_store: AppSettingsStore,
    /// Set once the SMTP listener runs, so samples can go through it.
    pub sample_email_sender: Option<Arc<dyn SampleEmailSender>>,
    pub update_checker: UpdateChecker,
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
        Self {
            smtp_session_repository,
            api_request_repository,
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
        }
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
