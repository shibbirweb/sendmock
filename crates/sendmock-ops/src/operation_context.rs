use std::sync::Arc;

use sendmock_core::{Clock, IdGenerator};
use sendmock_mail::EmailIngestService;
use sendmock_store::{Database, EmailRepository};

use crate::InstanceDetails;

/// The dependencies operations run with, passed in rather than reached through globals.
#[derive(Clone)]
pub struct OperationContext {
    pub database: Arc<Database>,
    pub clock: Arc<dyn Clock>,
    pub id_generator: Arc<dyn IdGenerator>,
    pub instance_details: Arc<InstanceDetails>,
    pub email_repository: EmailRepository,
    pub email_ingest_service: EmailIngestService,
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
        Self {
            database,
            clock,
            id_generator,
            instance_details: Arc::new(instance_details),
            email_repository,
            email_ingest_service,
        }
    }
}
