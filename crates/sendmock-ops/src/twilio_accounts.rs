mod twilio_account_directory;
mod twilio_debugger;
mod twilio_signing_vars;
mod twilio_subaccount_builder;
mod twilio_subaccount_inputs;
mod twilio_subaccount_operations;
mod twilio_subaccount_views;

pub(crate) use twilio_account_directory::{
    TWILIO_PROVIDER_KEY, TwilioAccount, TwilioAccountDirectory,
};
pub(crate) use twilio_debugger::{
    DEBUGGER_REPORTED_STATUS, DebuggerProblem, report_failed_inbound_webhook,
    report_failed_message, send_debugger_event,
};
pub(crate) use twilio_signing_vars::{
    apply_twilio_account_vars, default_twilio_account_variables, find_conversation_account,
};
pub(crate) use twilio_subaccount_builder::{
    build_subaccount, generate_account_sid, is_account_sid,
};
pub use twilio_subaccount_inputs::{TwilioAccountStatus, TwilioSubaccountChanges};
pub use twilio_subaccount_operations::{
    CreateTwilioSubaccountOperation, DeleteTwilioSubaccountOperation,
    ListTwilioSubaccountsOperation, RevealTwilioSubaccountTokenOperation,
    UpdateTwilioSubaccountOperation,
};
pub use twilio_subaccount_views::{TwilioSubaccount, TwilioSubaccountTokenReveal};

use crate::OperationRegistry;

/// Every Twilio subaccount operation this build serves.
pub fn register_twilio_account_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListTwilioSubaccountsOperation);
    operation_registry.register(CreateTwilioSubaccountOperation);
    operation_registry.register(UpdateTwilioSubaccountOperation);
    operation_registry.register(DeleteTwilioSubaccountOperation);
    operation_registry.register(RevealTwilioSubaccountTokenOperation);
}
