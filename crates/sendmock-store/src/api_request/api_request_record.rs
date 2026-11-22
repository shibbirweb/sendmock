use std::collections::BTreeMap;

/// One logged API request; headers are already masked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiRequestRecord {
    pub request_id: String,
    pub api: String,
    pub method: String,
    pub path: String,
    pub request_headers: BTreeMap<String, String>,
    pub request_body: String,
    pub response_status: u16,
    pub response_body: String,
    pub duration_ms: u64,
    /// `email` or `sms`, with the id of what the request created.
    pub linked_message: Option<(String, String)>,
    /// The HTTP Catcher bin and rule that answered a provider request no built-in operation
    /// answers.
    pub catcher_answer: Option<CatcherAnswerRecord>,
    /// Why SendMock answered as it did, when the answer alone does not say.
    pub note: Option<String>,
    pub created_at_unix_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatcherAnswerRecord {
    pub bin_name: String,
    /// `None` when the bin's default reply answered.
    pub rule_name: Option<String>,
}

/// Which requests to list; every field narrows the list.
#[derive(Debug, Clone, Default)]
pub struct ApiRequestFilter {
    pub api: Option<String>,
    /// The hundreds digit of the status: 2 for `2xx`, 4 for `4xx`.
    pub status_hundreds: Option<u16>,
    pub path_contains: Option<String>,
}

/// One page of requests, newest first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiRequestPage {
    pub requests: Vec<ApiRequestRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
