mod preset_catalog;
mod preset_env_block;
mod preset_operations;
mod preset_setup_text;
mod preset_steps;
mod preset_wire;

pub use preset_operations::{ApplyPresetOperation, ListPresetsOperation};

use crate::OperationRegistry;

pub fn register_preset_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListPresetsOperation);
    operation_registry.register(ApplyPresetOperation);
}
