mod delivery_attempt_recording;
mod delivery_detail;
mod delivery_dispatch;
mod delivery_inputs;
mod delivery_operations;
mod delivery_queue;
mod delivery_request_rendering;
mod delivery_signing;
mod delivery_template_context;
mod delivery_view;
mod delivery_wait_operation;
mod endpoint_body_rendering;
mod endpoint_inputs;
mod endpoint_operations;
mod endpoint_preview_operation;
mod endpoint_request_rendering;
mod endpoint_secret_operations;
mod endpoint_settings;
mod endpoint_validation;
mod endpoint_view;
mod request_part_renderer;
mod rule_filter_wire;
mod rule_inputs;
mod rule_messages;
mod rule_move_operation;
mod rule_operations;
mod rule_preview_operation;
mod rule_subscriber;
mod rule_validation;
mod rule_view;
mod secret_value_masking;
mod template_context;
mod variable_inputs;
mod variable_operations;
mod variable_resolution;
mod variable_validation;
mod variable_value_operations;
mod variable_view;
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
pub use endpoint_preview_operation::{EndpointPreviewResult, PreviewWebhookEndpointOperation};
pub use endpoint_secret_operations::{
    RevealWebhookEndpointSecretOperation, RevealedEndpointSecret,
    RotateWebhookEndpointSecretOperation,
};
pub use endpoint_view::WebhookEndpoint;
pub use rule_move_operation::MoveWebhookRuleOperation;
pub use rule_operations::{
    CreateWebhookRuleOperation, DeleteWebhookRuleOperation, GetWebhookRuleOperation,
    ListWebhookRulesOperation, UpdateWebhookRuleOperation,
};
pub use rule_preview_operation::PreviewWebhookRuleOperation;
pub use rule_subscriber::{fire_matching_rules, run_webhook_rule_subscriber};
pub use rule_view::WebhookRule;
pub use template_context::{build_event_template_context, build_sample_template_context};
pub use variable_operations::{
    CreateWebhookVariableOperation, DeleteWebhookVariableOperation, ListWebhookVariablesOperation,
    UpdateWebhookVariableOperation,
};
pub use variable_resolution::{ResolvedVariables, resolve_template_variables};
pub use variable_value_operations::{
    PreviewWebhookVariableOperation, RegenerateWebhookVariableOperation, VariablePreviewResult,
};
pub use variable_view::WebhookVariable;
pub use webhook_sender::{WebhookSendFailure, WebhookSendResult, WebhookSender};

use crate::OperationRegistry;

/// Every webhook operation this build serves.
pub fn register_webhook_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListWebhookEndpointsOperation);
    operation_registry.register(CreateWebhookEndpointOperation);
    operation_registry.register(GetWebhookEndpointOperation);
    operation_registry.register(UpdateWebhookEndpointOperation);
    operation_registry.register(DeleteWebhookEndpointOperation);
    operation_registry.register(PreviewWebhookEndpointOperation);
    operation_registry.register(RevealWebhookEndpointSecretOperation);
    operation_registry.register(RotateWebhookEndpointSecretOperation);
    operation_registry.register(ListWebhookDeliveriesOperation);
    operation_registry.register(GetWebhookDeliveryOperation);
    operation_registry.register(CancelWebhookDeliveryOperation);
    operation_registry.register(WaitForWebhookOperation);
    operation_registry.register(ListWebhookRulesOperation);
    operation_registry.register(CreateWebhookRuleOperation);
    operation_registry.register(GetWebhookRuleOperation);
    operation_registry.register(UpdateWebhookRuleOperation);
    operation_registry.register(DeleteWebhookRuleOperation);
    operation_registry.register(MoveWebhookRuleOperation);
    operation_registry.register(PreviewWebhookRuleOperation);
    operation_registry.register(ListWebhookVariablesOperation);
    operation_registry.register(CreateWebhookVariableOperation);
    operation_registry.register(UpdateWebhookVariableOperation);
    operation_registry.register(DeleteWebhookVariableOperation);
    operation_registry.register(RegenerateWebhookVariableOperation);
    operation_registry.register(PreviewWebhookVariableOperation);
}
