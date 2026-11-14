/// Why a reply webhook answer gave no TwiML, with the error code Twilio reports for it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReplyWebhookFailure {
    /// A non-`2xx` answer, or none within 15 seconds: 11200.
    HttpRetrieval(String),
    /// The connection was refused, reset or could not be opened: 11205.
    HttpConnection(String),
    /// The body is not a TwiML `<Response>` document: 12100.
    DocumentParse(String),
    /// A content type Twilio does not read: 12300.
    InvalidContentType(String),
}

impl ReplyWebhookFailure {
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::HttpRetrieval(_) => "11200",
            Self::HttpConnection(_) => "11205",
            Self::DocumentParse(_) => "12100",
            Self::InvalidContentType(_) => "12300",
        }
    }

    /// Twilio's name for the error, then what happened.
    pub fn describe(&self) -> String {
        match self {
            Self::HttpRetrieval(detail) => format!("HTTP retrieval failure: {detail}"),
            Self::HttpConnection(detail) => format!("HTTP connection failure: {detail}"),
            Self::DocumentParse(detail) => format!("Document parse failure: {detail}"),
            Self::InvalidContentType(content_type) => {
                format!("Invalid Content-Type: {content_type}")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_failure_carries_twilios_code_and_name() {
        let refused = ReplyWebhookFailure::HttpConnection("connection refused".to_owned());
        assert_eq!(refused.error_code(), "11205");
        assert_eq!(
            refused.describe(),
            "HTTP connection failure: connection refused"
        );
        assert_eq!(
            ReplyWebhookFailure::HttpRetrieval(String::new()).error_code(),
            "11200"
        );
        assert_eq!(
            ReplyWebhookFailure::DocumentParse(String::new()).error_code(),
            "12100"
        );
        let json_answer = ReplyWebhookFailure::InvalidContentType("application/json".to_owned());
        assert_eq!(json_answer.error_code(), "12300");
        assert_eq!(
            json_answer.describe(),
            "Invalid Content-Type: application/json"
        );
    }
}
