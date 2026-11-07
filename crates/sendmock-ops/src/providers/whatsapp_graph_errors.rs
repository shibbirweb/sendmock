//! Meta's Graph API error object, which the Cloud API answers for every refused request.

use serde_json::json;

use super::provider_http::ProviderHttpResponse;
use super::twilio_answers::answer_json;
use crate::OperationContext;

/// Graph's code for an invalid or missing parameter.
pub const INVALID_PARAMETER_CODE: u32 = 100;
/// The Cloud API's code for a message it could not deliver.
pub const UNDELIVERABLE_CODE: u32 = 131_026;

/// A refusal in Graph's shape: `(#<code>) <message>` with the details for WhatsApp, and a
/// trace id like Meta's.
pub fn answer_graph_error(
    operation_context: &OperationContext,
    status: u16,
    code: u32,
    message: &str,
    details: &str,
) -> ProviderHttpResponse {
    answer_json(
        status,
        json!({
            "error": {
                "message": format!("(#{code}) {message}"),
                "type": "OAuthException",
                "code": code,
                "error_data": {
                    "messaging_product": "whatsapp",
                    "details": details,
                },
                "fbtrace_id": format!("A{:016X}", operation_context.random_source.next_u64()),
            }
        }),
    )
}

/// A missing or wrong parameter: Graph says `(#100)` and repeats the reason as details.
pub fn answer_invalid_parameter(
    operation_context: &OperationContext,
    reason: &str,
) -> ProviderHttpResponse {
    answer_graph_error(
        operation_context,
        400,
        INVALID_PARAMETER_CODE,
        reason,
        reason,
    )
}
