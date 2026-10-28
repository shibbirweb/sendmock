use std::sync::Arc;

use sendmock_core::Clock;
use sendmock_store::Database;

use crate::InstanceDetails;

/// The dependencies operations run with, passed in rather than reached through globals.
#[derive(Clone)]
pub struct OperationContext {
    pub database: Arc<Database>,
    pub clock: Arc<dyn Clock>,
    pub instance_details: Arc<InstanceDetails>,
}
