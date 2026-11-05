mod checkout_completion_operation;
mod checkout_completion_views;
mod checkout_operations;
mod checkout_payment_run;
mod checkout_views;
mod gateway_template_functions;
mod gateway_template_rendering;
mod payment_catalogue;
mod payment_change;
mod payment_definition_store;
mod payment_event_data;
mod payment_flow_catalogue;
mod payment_flow_operations;
mod payment_flow_step_operations;
mod payment_flow_views;
mod payment_gateway_catalogue;
mod payment_gateway_maintenance_operations;
mod payment_gateway_operations;
mod payment_gateway_preview_operation;
mod payment_gateway_preview_views;
mod payment_gateway_views;
mod payment_method_catalogue;
mod payment_method_operations;
mod payment_method_views;
mod payment_notification;
mod payment_notify_operation;
mod payment_operations;
mod payment_redirect;
mod payment_settlement;
mod payment_simulate_operation;
mod payment_simulate_views;
mod payment_views;
mod payment_wait_operation;
mod provider_event_object;
mod provider_object_store;
mod provider_payment;

pub use checkout_completion_operation::CompleteCheckoutOperation;
pub use checkout_operations::{CreatePaymentCheckoutOperation, GetCheckoutSessionOperation};
pub(crate) use checkout_payment_run::pay_with_test_card;
pub(crate) use gateway_template_rendering::{
    GatewayPartRenderer, GatewayRenderOptions, build_gateway_context,
};
pub(crate) use payment_catalogue::{find_payment, read_payment_document};
pub(crate) use payment_change::PaymentChange;
pub(crate) use payment_event_data::{build_sample_payment_event_data, load_payment_event};
pub use payment_flow_operations::{
    CreatePaymentFlowOperation, DeletePaymentFlowOperation, GetPaymentFlowOperation,
    ListPaymentFlowsOperation, ResetPaymentFlowOperation, UpdatePaymentFlowOperation,
};
pub use payment_flow_step_operations::{
    AddPaymentFlowStepOperation, ListPaymentFlowVariablesOperation, ListPaymentStepTypesOperation,
    RemovePaymentFlowStepOperation, UpdatePaymentFlowStepOperation,
};
pub use payment_flow_views::{PaymentFlowDefinition, PaymentFlowStep};
pub(crate) use payment_gateway_catalogue::find_payment_gateway;
pub use payment_gateway_maintenance_operations::{
    DeletePaymentGatewayOperation, ResetPaymentGatewayOperation, RevealGatewayCredentialOperation,
};
pub use payment_gateway_operations::{
    CreatePaymentGatewayOperation, GetPaymentGatewayOperation, ListPaymentGatewaysOperation,
    UpdatePaymentGatewayOperation,
};
pub use payment_gateway_preview_operation::PreviewPaymentGatewayOperation;
pub use payment_gateway_views::PaymentGatewayDefinition;
pub(crate) use payment_gateway_views::PaymentGatewayFields;
pub(crate) use payment_method_catalogue::find_payment_method;
pub use payment_method_operations::{
    CreatePaymentMethodOperation, DeletePaymentMethodOperation, GetPaymentMethodOperation,
    ListPaymentMethodsOperation, ResetPaymentMethodOperation, UpdatePaymentMethodOperation,
};
pub use payment_method_views::PaymentMethodDefinition;
pub(crate) use payment_notification::read_redirect_outcome;
pub use payment_notify_operation::NotifyPaymentOperation;
pub use payment_operations::{
    GetPaymentOperation, ListPaymentTestValuesOperation, ListPaymentsOperation,
};
pub(crate) use payment_settlement::read_refundable_minor;
pub use payment_simulate_operation::SimulatePaymentOperation;
pub(crate) use payment_simulate_views::DisputeOutcome;
pub use payment_views::{
    PaymentCaptureMethod, PaymentDetail, PaymentInstrument, PaymentLineItem, PaymentStatus,
    PaymentSummary,
};
#[cfg(test)]
pub(crate) use payment_views::{PaymentDispute, PaymentTimelineEvent};
pub use payment_wait_operation::WaitForPaymentOperation;
pub(crate) use provider_object_store::{
    ProviderObjectKey, find_provider_object, keep_provider_object, list_kept_or_stored_objects,
    list_payment_provider_objects, read_kept_or_stored_object, save_provider_object,
};
pub(crate) use provider_payment::{
    ProviderCheckoutUrls, ProviderPaymentRequest, apply_checkout_outcome_profile,
    start_provider_payment,
};

use crate::OperationRegistry;

pub fn register_payment_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListPaymentStepTypesOperation);
    operation_registry.register(ListPaymentFlowVariablesOperation);
    operation_registry.register(ListPaymentFlowsOperation);
    operation_registry.register(CreatePaymentFlowOperation);
    operation_registry.register(GetPaymentFlowOperation);
    operation_registry.register(UpdatePaymentFlowOperation);
    operation_registry.register(DeletePaymentFlowOperation);
    operation_registry.register(ResetPaymentFlowOperation);
    operation_registry.register(AddPaymentFlowStepOperation);
    operation_registry.register(UpdatePaymentFlowStepOperation);
    operation_registry.register(RemovePaymentFlowStepOperation);
    operation_registry.register(ListPaymentMethodsOperation);
    operation_registry.register(CreatePaymentMethodOperation);
    operation_registry.register(GetPaymentMethodOperation);
    operation_registry.register(UpdatePaymentMethodOperation);
    operation_registry.register(DeletePaymentMethodOperation);
    operation_registry.register(ResetPaymentMethodOperation);
    operation_registry.register(ListPaymentGatewaysOperation);
    operation_registry.register(CreatePaymentGatewayOperation);
    operation_registry.register(GetPaymentGatewayOperation);
    operation_registry.register(UpdatePaymentGatewayOperation);
    operation_registry.register(DeletePaymentGatewayOperation);
    operation_registry.register(ResetPaymentGatewayOperation);
    operation_registry.register(RevealGatewayCredentialOperation);
    operation_registry.register(PreviewPaymentGatewayOperation);
    operation_registry.register(ListPaymentsOperation);
    operation_registry.register(ListPaymentTestValuesOperation);
    operation_registry.register(CreatePaymentCheckoutOperation);
    operation_registry.register(GetPaymentOperation);
    operation_registry.register(NotifyPaymentOperation);
    operation_registry.register(WaitForPaymentOperation);
    operation_registry.register(SimulatePaymentOperation);
    operation_registry.register(GetCheckoutSessionOperation);
    operation_registry.register(CompleteCheckoutOperation);
}
