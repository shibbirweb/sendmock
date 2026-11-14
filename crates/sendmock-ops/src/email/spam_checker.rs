use std::future::Future;
use std::pin::Pin;

pub use sendmock_mail::{SpamdReport, SpamdRule};

/// Asks a SpamAssassin `spamd` for its report on a raw message; the error says why it could
/// not answer (unreachable, timed out, refused).
pub trait SpamChecker: Send + Sync {
    fn request_spam_report<'checker>(
        &'checker self,
        spamd_address: &'checker str,
        raw_message: &'checker [u8],
    ) -> Pin<Box<dyn Future<Output = Result<SpamdReport, String>> + Send + 'checker>>;
}
