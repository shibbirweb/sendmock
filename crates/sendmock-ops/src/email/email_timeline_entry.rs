use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::TimelineRecord;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct EmailTimelineEntry {
    pub kind: String,
    pub at: String,
    pub detail: String,
}

impl From<TimelineRecord> for EmailTimelineEntry {
    fn from(timeline_record: TimelineRecord) -> Self {
        Self {
            kind: timeline_record.kind,
            at: format_rfc3339(timeline_record.happened_at_unix_ms),
            detail: timeline_record.detail,
        }
    }
}
