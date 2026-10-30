mod verification_code_delivery;
mod verification_flow;
mod verification_lookups;
mod verification_operations;
mod verification_outcomes;
mod verify_inputs;
mod verify_service_operations;
mod verify_views;

pub use verification_flow::{
    VerificationStart, VerifyRefusal, check_verification, start_verification,
};
pub use verification_lookups::find_newest_verification;
pub use verification_operations::{
    ForceVerificationOperation, GetVerificationOperation, ListVerificationsOperation,
};
pub use verification_outcomes::{expire_overdue_verifications, finish_verification};
pub use verify_service_operations::{
    CreateVerifyServiceOperation, DeleteVerifyServiceOperation, ListVerifyServicesOperation,
    UpdateVerifyServiceOperation, new_verify_service,
};
pub use verify_views::{Verification, VerificationDetail, VerifyService};

use crate::OperationRegistry;

/// Every native Verify operation this build serves.
pub fn register_verify_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListVerificationsOperation);
    operation_registry.register(GetVerificationOperation);
    operation_registry.register(ForceVerificationOperation);
    operation_registry.register(ListVerifyServicesOperation);
    operation_registry.register(CreateVerifyServiceOperation);
    operation_registry.register(UpdateVerifyServiceOperation);
    operation_registry.register(DeleteVerifyServiceOperation);
}
