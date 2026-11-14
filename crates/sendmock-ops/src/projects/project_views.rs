use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::ProjectRecord;
use serde::Serialize;

/// A name for captured traffic: the emails, SMS and verifications sent to it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Project {
    /// What apps send as the SMTP username, the `X-SendMock-Project` header or the
    /// `/projects/<key>/` URL prefix.
    pub key: String,
    pub name: String,
    pub created_at: String,
    pub email_count: u64,
    pub sms_count: u64,
    pub verification_count: u64,
}

impl From<ProjectRecord> for Project {
    fn from(project_record: ProjectRecord) -> Self {
        Self {
            created_at: format_rfc3339(project_record.created_at_unix_ms),
            key: project_record.project_key,
            name: project_record.name,
            email_count: project_record.email_count,
            sms_count: project_record.sms_count,
            verification_count: project_record.verification_count,
        }
    }
}
