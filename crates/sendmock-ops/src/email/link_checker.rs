use std::future::Future;
use std::pin::Pin;

/// What one request to a link answered.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct LinkProbe {
    pub status_code: Option<u16>,
    /// Where a redirect points, when the link answered one.
    pub redirect_url: Option<String>,
    pub duration_ms: Option<u32>,
    /// Why there is no answer: a timeout, a refused connection, a bad URL.
    pub error_message: Option<String>,
}

/// Requests a link the way a mail client would follow it, without following redirects.
pub trait LinkChecker: Send + Sync {
    fn probe_link<'checker>(
        &'checker self,
        link_url: &'checker str,
    ) -> Pin<Box<dyn Future<Output = LinkProbe> + Send + 'checker>>;
}
