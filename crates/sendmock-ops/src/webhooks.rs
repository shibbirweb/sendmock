mod delivery_attempt_recording;
mod delivery_detail;
mod delivery_dispatch;
mod delivery_inputs;
mod delivery_operations;
mod delivery_queue;
mod delivery_signing;
mod delivery_view;
mod delivery_wait_operation;
mod endpoint_inputs;
mod endpoint_operations;
mod endpoint_secret_operations;
mod endpoint_settings;
mod endpoint_validation;
mod endpoint_view;
mod webhook_sender;

pub use delivery_detail::WebhookDeliveryDetail;
pub use delivery_dispatch::{run_due_deliveries, run_webhook_dispatcher};
pub use delivery_operations::{
    CancelWebhookDeliveryOperation, GetWebhookDeliveryOperation, ListWebhookDeliveriesOperation,
};
pub use delivery_queue::{DeliveryOrder, DeliveryTrigger, enqueue_webhook_delivery};
pub use delivery_view::WebhookDelivery;
pub use delivery_wait_operation::WaitForWebhookOperation;
pub use endpoint_operations::{
    CreateWebhookEndpointOperation, DeleteWebhookEndpointOperation, GetWebhookEndpointOperation,
    ListWebhookEndpointsOperation, UpdateWebhookEndpointOperation,
};
pub use endpoint_secret_operations::{
    RevealWebhookEndpointSecretOperation, RevealedEndpointSecret,
    RotateWebhookEndpointSecretOperation,
};
pub use endpoint_view::WebhookEndpoint;
pub use webhook_sender::{WebhookSendFailure, WebhookSendResult, WebhookSender};

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
    operation_registry.register(ListWebhookDeliveriesOperation);
    operation_registry.register(GetWebhookDeliveryOperation);
    operation_registry.register(CancelWebhookDeliveryOperation);
    operation_registry.register(WaitForWebhookOperation);
}
