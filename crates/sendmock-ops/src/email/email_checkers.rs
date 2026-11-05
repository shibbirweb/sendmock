use std::sync::Arc;

use super::link_checker::LinkChecker;
use super::spam_checker::SpamChecker;

/// The checks that reach outside SendMock, which the binary provides and tests replace.
#[derive(Clone, Default)]
pub struct EmailCheckers {
    /// `None` where no HTTP client exists; each link then reports why.
    pub link_checker: Option<Arc<dyn LinkChecker>>,
    /// `None` where no spamd client exists; the spam check then reports it is not available.
    pub spam_checker: Option<Arc<dyn SpamChecker>>,
}
