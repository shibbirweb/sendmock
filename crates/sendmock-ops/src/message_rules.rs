//! Tag rules and auto-forward rules: what happens to each email as it arrives.

mod forward_rule_operations;
mod message_rule_checks;
mod message_rule_inputs;
mod message_rule_runner;
mod message_rule_views;
mod tag_rule_operations;

pub use forward_rule_operations::{
    CreateForwardRuleOperation, DeleteForwardRuleOperation, ListForwardRulesOperation,
    MoveForwardRuleOperation, UpdateForwardRuleOperation,
};
pub(crate) use message_rule_runner::{apply_tag_rules, start_forward_rules};
pub use message_rule_views::{ForwardRule, TagRule};
pub use tag_rule_operations::{
    CreateTagRuleOperation, DeleteTagRuleOperation, ListTagRulesOperation, MoveTagRuleOperation,
    UpdateTagRuleOperation,
};

use crate::OperationRegistry;

pub fn register_message_rule_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListTagRulesOperation);
    operation_registry.register(CreateTagRuleOperation);
    operation_registry.register(UpdateTagRuleOperation);
    operation_registry.register(DeleteTagRuleOperation);
    operation_registry.register(MoveTagRuleOperation);
    operation_registry.register(ListForwardRulesOperation);
    operation_registry.register(CreateForwardRuleOperation);
    operation_registry.register(UpdateForwardRuleOperation);
    operation_registry.register(DeleteForwardRuleOperation);
    operation_registry.register(MoveForwardRuleOperation);
}
