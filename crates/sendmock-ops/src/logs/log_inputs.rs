use schemars::JsonSchema;
use serde::Deserialize;

pub const DEFAULT_LOG_PAGE_SIZE: u32 = 50;
pub const MAXIMUM_LOG_PAGE_SIZE: u32 = 200;

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SmtpSessionListInput {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    /// Items per page, 1 to 200 (default 50).
    pub limit: Option<u32>,
    /// delivered or failed.
    pub result: Option<String>,
    /// Client, EHLO name or user.
    pub query: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SmtpSessionReference {
    /// The SMTP session's ID, from `GET /api/v1/logs/smtp`.
    pub session_id: String,
}

/// A status class filter for the request log.
#[derive(Debug, Clone, Copy, Deserialize, JsonSchema)]
pub enum ApiStatusClass {
    #[serde(rename = "2xx")]
    Success,
    #[serde(rename = "4xx")]
    ClientError,
    #[serde(rename = "5xx")]
    ServerError,
}

impl ApiStatusClass {
    pub fn hundreds_digit(self) -> u16 {
        match self {
            Self::Success => 2,
            Self::ClientError => 4,
            Self::ServerError => 5,
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ApiRequestListInput {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    /// Items per page, 1 to 200 (default 50).
    pub limit: Option<u32>,
    /// Which API, e.g. twilio.
    pub api: Option<String>,
    /// 2xx, 4xx or 5xx.
    pub status_class: Option<ApiStatusClass>,
    /// Part of the path.
    pub path: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ApiRequestReference {
    /// The captured request's ID, from `GET /api/v1/http/requests` or `GET /api/v1/logs/http`.
    pub request_id: String,
}

/// The page size asked for, kept between 1 and the maximum.
pub fn read_page_size(limit: Option<u32>) -> u32 {
    limit
        .unwrap_or(DEFAULT_LOG_PAGE_SIZE)
        .clamp(1, MAXIMUM_LOG_PAGE_SIZE)
}
