//! The agent skill and how each AI agent connects (AI-05).

mod agent_setups;
mod ai_operations;
mod skill_files;

pub use agent_setups::{AiAgentSetup, AiAgentTarget, list_agent_setups};
pub use ai_operations::{GetAiSkillOperation, ListAiAgentsOperation};
pub use skill_files::{SKILL_EXAMPLES, render_skill_markdown};

use crate::OperationRegistry;

pub fn register_ai_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListAiAgentsOperation);
    operation_registry.register(GetAiSkillOperation);
}
