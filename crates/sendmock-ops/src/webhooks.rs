mod delivery_attempt_recording;
mod delivery_detail;
mod delivery_dispatch;
mod delivery_inputs;
mod delivery_operations;
mod delivery_queue;
mod delivery_replay_operation;
mod delivery_request_plan;
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
mod endpoint_save_as_template_operation;
mod endpoint_secret_operations;
mod endpoint_settings;
mod endpoint_template;
mod endpoint_template_body_rendering;
mod endpoint_template_overrides;
mod endpoint_test_operation;
mod endpoint_validation;
mod endpoint_view;
mod manual_send_operation;
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
mod saved_delivery_inputs;
mod saved_delivery_operations;
mod saved_delivery_send_operation;
mod saved_delivery_template_operation;
mod saved_delivery_view;
mod secret_value_masking;
mod template_catalogue;
mod template_context;
mod template_delete_operation;
mod template_edit_operations;
mod template_file;
mod template_file_operations;
mod template_inputs;
mod template_operations;
mod template_reference;
mod template_reference_operation;
mod template_rendering;
mod template_request_rendering;
mod template_store;
mod template_view;
mod variable_inputs;
mod variable_operations;
mod variable_resolution;
mod variable_validation;
mod variable_value_operations;
mod variable_view;
mod webhook_sender;
mod webhook_template_functions;

pub use delivery_detail::WebhookDeliveryDetail;
pub use delivery_dispatch::{run_due_deliveries, run_webhook_dispatcher};
pub use delivery_operations::{
    CancelWebhookDeliveryOperation, GetWebhookDeliveryOperation, ListWebhookDeliveriesOperation,
};
pub use delivery_queue::{DeliveryOrder, DeliveryTrigger, enqueue_webhook_delivery};
pub use delivery_replay_operation::ReplayWebhookDeliveryOperation;
pub use delivery_view::WebhookDelivery;
pub use delivery_wait_operation::WaitForWebhookOperation;
pub use endpoint_operations::{
    CreateWebhookEndpointOperation, DeleteWebhookEndpointOperation, GetWebhookEndpointOperation,
    ListWebhookEndpointsOperation, UpdateWebhookEndpointOperation,
};
pub use endpoint_preview_operation::{EndpointPreviewResult, PreviewWebhookEndpointOperation};
pub use endpoint_save_as_template_operation::SaveWebhookEndpointAsTemplateOperation;
pub use endpoint_secret_operations::{
    RevealWebhookEndpointSecretOperation, RevealedEndpointSecret,
    RotateWebhookEndpointSecretOperation,
};
pub use endpoint_test_operation::TestWebhookEndpointOperation;
pub use endpoint_view::WebhookEndpoint;
pub use manual_send_operation::SendWebhookOperation;
pub use rule_move_operation::MoveWebhookRuleOperation;
pub use rule_operations::{
    CreateWebhookRuleOperation, DeleteWebhookRuleOperation, GetWebhookRuleOperation,
    ListWebhookRulesOperation, UpdateWebhookRuleOperation,
};
pub use rule_preview_operation::PreviewWebhookRuleOperation;
pub use rule_subscriber::{fire_matching_rules, run_webhook_rule_subscriber};
pub use rule_view::WebhookRule;
pub use saved_delivery_operations::{
    CreateSavedWebhookDeliveryOperation, DeleteSavedWebhookDeliveryOperation,
    ListSavedWebhookDeliveriesOperation, RenameSavedWebhookDeliveryOperation,
};
pub use saved_delivery_send_operation::SendSavedWebhookDeliveryOperation;
pub use saved_delivery_template_operation::SaveSavedWebhookDeliveryAsTemplateOperation;
pub use saved_delivery_view::SavedDelivery;
pub use template_context::{build_event_template_context, build_sample_template_context};
pub use template_delete_operation::DeleteWebhookTemplateOperation;
pub use template_edit_operations::{
    ListWebhookTemplateRevisionsOperation, ResetWebhookTemplateOperation,
    RestoreWebhookTemplateRevisionOperation, UpdateWebhookTemplateOperation,
};
pub use template_file_operations::{
    ExportWebhookTemplateOperation, ImportWebhookTemplateOperation,
};
pub use template_operations::{
    CloneWebhookTemplateOperation, CreateWebhookTemplateOperation, GetWebhookTemplateOperation,
    ListWebhookTemplatesOperation, RenderWebhookTemplateOperation,
};
pub use template_reference_operation::GetWebhookTemplateReferenceOperation;
pub use template_rendering::TemplateRenderResult;
pub use template_view::{TemplateRevision, WebhookTemplateDetail, WebhookTemplateSummary};
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
    operation_registry.register(SaveWebhookEndpointAsTemplateOperation);
    operation_registry.register(TestWebhookEndpointOperation);
    operation_registry.register(SendWebhookOperation);
    operation_registry.register(ListWebhookDeliveriesOperation);
    operation_registry.register(GetWebhookDeliveryOperation);
    operation_registry.register(CancelWebhookDeliveryOperation);
    operation_registry.register(ReplayWebhookDeliveryOperation);
    operation_registry.register(WaitForWebhookOperation);
    operation_registry.register(ListSavedWebhookDeliveriesOperation);
    operation_registry.register(CreateSavedWebhookDeliveryOperation);
    operation_registry.register(RenameSavedWebhookDeliveryOperation);
    operation_registry.register(DeleteSavedWebhookDeliveryOperation);
    operation_registry.register(SendSavedWebhookDeliveryOperation);
    operation_registry.register(SaveSavedWebhookDeliveryAsTemplateOperation);
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
    operation_registry.register(ListWebhookTemplatesOperation);
    operation_registry.register(CreateWebhookTemplateOperation);
    operation_registry.register(GetWebhookTemplateOperation);
    operation_registry.register(UpdateWebhookTemplateOperation);
    operation_registry.register(DeleteWebhookTemplateOperation);
    operation_registry.register(ListWebhookTemplateRevisionsOperation);
    operation_registry.register(RestoreWebhookTemplateRevisionOperation);
    operation_registry.register(RenderWebhookTemplateOperation);
    operation_registry.register(ResetWebhookTemplateOperation);
    operation_registry.register(CloneWebhookTemplateOperation);
    operation_registry.register(ImportWebhookTemplateOperation);
    operation_registry.register(ExportWebhookTemplateOperation);
    operation_registry.register(GetWebhookTemplateReferenceOperation);
}
