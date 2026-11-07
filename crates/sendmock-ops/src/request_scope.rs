use crate::RequestClient;

/// What one request says about itself: who sent it and which project its traffic goes to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestScope {
    /// Recorded as `created_by` on what the request creates.
    pub client: RequestClient,
    /// Where the request's emails, SMS and verifications are stored: `default`, or the
    /// project it named.
    pub project_key: String,
}

impl Default for RequestScope {
    fn default() -> Self {
        Self {
            client: RequestClient::default(),
            project_key: sendmock_store::DEFAULT_PROJECT_KEY.to_owned(),
        }
    }
}
