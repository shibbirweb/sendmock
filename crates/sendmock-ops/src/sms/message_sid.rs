use crate::OperationContext;

/// `SM` and 32 hex digits, as Twilio writes message SIDs.
pub fn generate_message_sid(operation_context: &OperationContext) -> String {
    let random_source = &operation_context.random_source;
    format!(
        "SM{:016x}{:016x}",
        random_source.next_u64(),
        random_source.next_u64()
    )
}
