mod messaging_service_builder;
mod messaging_service_operations;
mod number_inputs;
mod number_views;
mod registry_fields;
mod virtual_number_builder;
mod virtual_number_operations;

pub use messaging_service_operations::{
    CreateMessagingServiceOperation, DeleteMessagingServiceOperation,
    ListMessagingServicesOperation, UpdateMessagingServiceOperation,
};
pub use number_views::{MessagingService, VirtualNumber};
pub use virtual_number_operations::{
    CreateVirtualNumberOperation, DeleteVirtualNumberOperation, ListVirtualNumbersOperation,
    UpdateVirtualNumberOperation,
};

use crate::OperationRegistry;

/// Every virtual number and Messaging Service operation this build serves.
pub fn register_number_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListVirtualNumbersOperation);
    operation_registry.register(CreateVirtualNumberOperation);
    operation_registry.register(UpdateVirtualNumberOperation);
    operation_registry.register(DeleteVirtualNumberOperation);
    operation_registry.register(ListMessagingServicesOperation);
    operation_registry.register(CreateMessagingServiceOperation);
    operation_registry.register(UpdateMessagingServiceOperation);
    operation_registry.register(DeleteMessagingServiceOperation);
}
