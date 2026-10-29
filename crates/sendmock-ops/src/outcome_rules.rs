mod sms_outcome_rule_inputs;
mod sms_outcome_rule_operations;
mod sms_outcome_rule_order_operations;
mod sms_outcome_rule_validation;
mod sms_outcome_rule_view;

pub use sms_outcome_rule_operations::{
    CreateSmsOutcomeRuleOperation, DeleteSmsOutcomeRuleOperation, ListSmsOutcomeRulesOperation,
    UpdateSmsOutcomeRuleOperation,
};
pub use sms_outcome_rule_order_operations::{MoveSmsOutcomeRuleOperation, TestSmsOutcomeOperation};
pub use sms_outcome_rule_view::{OutcomeTestResult, SmsOutcomeRule};

use crate::OperationRegistry;

/// Every outcome rule operation this build serves.
pub fn register_outcome_rule_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmsOutcomeRulesOperation);
    operation_registry.register(CreateSmsOutcomeRuleOperation);
    operation_registry.register(UpdateSmsOutcomeRuleOperation);
    operation_registry.register(DeleteSmsOutcomeRuleOperation);
    operation_registry.register(MoveSmsOutcomeRuleOperation);
    operation_registry.register(TestSmsOutcomeOperation);
}
