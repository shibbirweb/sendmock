mod payment_flow_catalogue;
mod payment_flow_operations;
mod payment_flow_step_operations;
mod payment_flow_views;
mod payment_method_catalogue;
mod payment_method_operations;
mod payment_method_views;

pub use payment_flow_operations::{
    CreatePaymentFlowOperation, DeletePaymentFlowOperation, GetPaymentFlowOperation,
    ListPaymentFlowsOperation, ResetPaymentFlowOperation, UpdatePaymentFlowOperation,
};
pub use payment_flow_step_operations::{
    AddPaymentFlowStepOperation, ListPaymentFlowVariablesOperation, ListPaymentStepTypesOperation,
    RemovePaymentFlowStepOperation, UpdatePaymentFlowStepOperation,
};
pub use payment_flow_views::{PaymentFlowDefinition, PaymentFlowStep};
pub use payment_method_operations::{
    CreatePaymentMethodOperation, DeletePaymentMethodOperation, GetPaymentMethodOperation,
    ListPaymentMethodsOperation, ResetPaymentMethodOperation, UpdatePaymentMethodOperation,
};
pub use payment_method_views::PaymentMethodDefinition;

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
}
