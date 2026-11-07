//! Push notifications: provider APIs answered in code, stored, and read back
//! (docs/plan/32-after-1-0.md, A7).

mod fcm_send_api;
mod push_api;
mod push_inputs;
mod push_operations;
mod push_store;
mod push_views;

pub(crate) use push_api::answer_push_api;
pub use push_inputs::{PushListQuery, PushReference, PushWaitQuery};
use push_operations::{
    DeletePushOperation, DeletePushesOperation, GetPushOperation, ListPushesOperation,
    WaitPushOperation,
};
pub use push_views::PushNotification;

use crate::OperationRegistry;

pub fn register_push_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListPushesOperation);
    operation_registry.register(GetPushOperation);
    operation_registry.register(DeletePushOperation);
    operation_registry.register(DeletePushesOperation);
    operation_registry.register(WaitPushOperation);
}
