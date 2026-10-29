use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::{VerificationRecord, VerificationTimelineRecord, VerifyServiceRecord};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct VerifyService {
    pub sid: String,
    pub friendly_name: String,
    pub code_length: u32,
    #[schemars(required)]
    pub fixed_code: Option<String>,
    pub ttl_seconds: u32,
    pub created_by: String,
}

impl From<VerifyServiceRecord> for VerifyService {
    fn from(stored_service: VerifyServiceRecord) -> Self {
        Self {
            sid: stored_service.service_sid,
            friendly_name: stored_service.friendly_name,
            code_length: stored_service.code_length,
            fixed_code: stored_service.fixed_code,
            ttl_seconds: stored_service.ttl_seconds,
            created_by: stored_service.created_by,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct Verification {
    pub sid: String,
    pub service_sid: String,
    pub service_name: String,
    pub to: String,
    pub channel: String,
    pub code: String,
    pub status: String,
    pub check_attempts: u32,
    pub send_attempts: u32,
    pub expires_at: String,
    pub created_at: String,
    /// The captured SMS or email that carried the code; null for `call`.
    #[schemars(required)]
    pub linked_message_id: Option<String>,
    #[schemars(required)]
    pub linked_thread_id: Option<String>,
}

impl From<&VerificationRecord> for Verification {
    fn from(verification: &VerificationRecord) -> Self {
        Self {
            sid: verification.verification_sid.clone(),
            service_sid: verification.service_sid.clone(),
            service_name: verification.service_name.clone(),
            to: verification.to_address.clone(),
            channel: verification.channel.clone(),
            code: verification.code.clone(),
            status: verification.status.clone(),
            check_attempts: verification.check_attempts,
            send_attempts: verification.send_attempts,
            expires_at: format_rfc3339(verification.expires_at_unix_ms),
            created_at: format_rfc3339(verification.created_at_unix_ms),
            linked_message_id: verification.linked_message_id.clone(),
            linked_thread_id: verification.linked_thread_id.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct VerificationTimelineEntry {
    pub kind: String,
    pub at: String,
    pub detail: String,
}

impl From<VerificationTimelineRecord> for VerificationTimelineEntry {
    fn from(timeline_entry: VerificationTimelineRecord) -> Self {
        Self {
            kind: timeline_entry.kind,
            at: format_rfc3339(timeline_entry.at_unix_ms),
            detail: timeline_entry.detail,
        }
    }
}

/// One verification with its timeline, as the drawer shows it.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct VerificationDetail {
    #[serde(flatten)]
    pub verification: Verification,
    pub timeline: Vec<VerificationTimelineEntry>,
}
