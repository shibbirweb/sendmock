use std::sync::Arc;

use super::email_relay::EmailRelay;
use super::link_checker::LinkChecker;
use super::spam_checker::SpamChecker;

/// What email features use to reach outside SendMock, which the binary provides and tests
/// replace; each is `None` in a build without it.
#[derive(Clone, Default)]
pub struct EmailNetworkClients {
    /// Without it, each link reports the check is not available.
    pub link_checker: Option<Arc<dyn LinkChecker>>,
    /// Without it, the spam check reports it is not available.
    pub spam_checker: Option<Arc<dyn SpamChecker>>,
    /// Without it, release and auto-forward are off.
    pub relay: Option<Arc<dyn EmailRelay>>,
}
