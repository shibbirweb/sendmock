/// A project with how much captured traffic it holds.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProjectRecord {
    pub project_key: String,
    pub name: String,
    pub created_at_unix_ms: i64,
    pub email_count: u64,
    pub sms_count: u64,
    pub verification_count: u64,
}

/// What deleting a project removed with it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DeletedProjectTraffic {
    pub email_count: u64,
    pub sms_count: u64,
    pub verification_count: u64,
}
