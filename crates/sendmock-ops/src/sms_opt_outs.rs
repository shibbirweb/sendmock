mod opt_out_auto_reply;
mod opt_out_guard;
mod opt_out_intake;
mod opt_out_operations;
mod opt_out_views;

pub(crate) use opt_out_guard::is_send_opted_out;
pub(crate) use opt_out_intake::respond_to_opt_out_keyword;
pub use opt_out_operations::{
    DeleteAllSmsOptOutsOperation, DeleteSmsOptOutOperation, ListSmsOptOutsOperation,
};

use crate::OperationRegistry;

pub fn register_sms_opt_out_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmsOptOutsOperation);
    operation_registry.register(DeleteSmsOptOutOperation);
    operation_registry.register(DeleteAllSmsOptOutsOperation);
}
