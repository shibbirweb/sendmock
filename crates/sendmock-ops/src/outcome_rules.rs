mod email_outcome_rule_inputs;
mod email_outcome_rule_loading;
mod email_outcome_rule_operations;
mod email_outcome_rule_order_operations;
mod email_outcome_rule_validation;
mod email_outcome_rule_view;
mod outcome_rule_inputs;
mod outcome_test_result;
mod sms_outcome_rule_inputs;
mod sms_outcome_rule_operations;
mod sms_outcome_rule_order_operations;
mod sms_outcome_rule_validation;
mod sms_outcome_rule_view;

pub use email_outcome_rule_loading::load_email_outcome_rules;
pub use email_outcome_rule_operations::{
    CreateEmailOutcomeRuleOperation, DeleteEmailOutcomeRuleOperation,
    ListEmailOutcomeRulesOperation, UpdateEmailOutcomeRuleOperation,
};
pub use email_outcome_rule_order_operations::{
    MoveEmailOutcomeRuleOperation, TestEmailOutcomeOperation,
};
pub(crate) use email_outcome_rule_validation::normalize_and_validate as validate_email_outcome_rule;
pub use email_outcome_rule_view::EmailOutcomeRule;
pub(crate) use outcome_rule_inputs::OutcomeRuleMoveDirection;
pub use outcome_test_result::OutcomeTestResult;
pub use sms_outcome_rule_operations::{
    CreateSmsOutcomeRuleOperation, DeleteSmsOutcomeRuleOperation, ListSmsOutcomeRulesOperation,
    UpdateSmsOutcomeRuleOperation,
};
pub use sms_outcome_rule_order_operations::{MoveSmsOutcomeRuleOperation, TestSmsOutcomeOperation};
pub(crate) use sms_outcome_rule_validation::normalize_and_validate as validate_sms_outcome_rule;
pub use sms_outcome_rule_view::SmsOutcomeRule;

use crate::OperationRegistry;

/// Every outcome rule operation this build serves.
pub fn register_outcome_rule_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListEmailOutcomeRulesOperation);
    operation_registry.register(CreateEmailOutcomeRuleOperation);
    operation_registry.register(UpdateEmailOutcomeRuleOperation);
    operation_registry.register(DeleteEmailOutcomeRuleOperation);
    operation_registry.register(MoveEmailOutcomeRuleOperation);
    operation_registry.register(TestEmailOutcomeOperation);
    operation_registry.register(ListSmsOutcomeRulesOperation);
    operation_registry.register(CreateSmsOutcomeRuleOperation);
    operation_registry.register(UpdateSmsOutcomeRuleOperation);
    operation_registry.register(DeleteSmsOutcomeRuleOperation);
    operation_registry.register(MoveSmsOutcomeRuleOperation);
    operation_registry.register(TestSmsOutcomeOperation);
}
