mod endpoint_inputs;
mod endpoint_operations;
mod endpoint_secret_operations;
mod endpoint_settings;
mod endpoint_validation;
mod endpoint_view;

pub use endpoint_operations::{
    CreateWebhookEndpointOperation, DeleteWebhookEndpointOperation, GetWebhookEndpointOperation,
    ListWebhookEndpointsOperation, UpdateWebhookEndpointOperation,
};
pub use endpoint_secret_operations::{
    RevealWebhookEndpointSecretOperation, RevealedEndpointSecret,
    RotateWebhookEndpointSecretOperation,
};
pub use endpoint_view::WebhookEndpoint;

use crate::OperationRegistry;

/// Every webhook operation this build serves.
pub fn register_webhook_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListWebhookEndpointsOperation);
    operation_registry.register(CreateWebhookEndpointOperation);
    operation_registry.register(GetWebhookEndpointOperation);
    operation_registry.register(UpdateWebhookEndpointOperation);
    operation_registry.register(DeleteWebhookEndpointOperation);
    operation_registry.register(RevealWebhookEndpointSecretOperation);
    operation_registry.register(RotateWebhookEndpointSecretOperation);
}
