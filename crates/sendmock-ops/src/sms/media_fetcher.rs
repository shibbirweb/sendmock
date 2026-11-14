use std::future::Future;
use std::pin::Pin;

/// A file downloaded from a `MediaUrl` or `media_urls` link.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchedMedia {
    pub content_type: Option<String>,
    pub bytes: Vec<u8>,
}

/// Downloads media links, as Twilio does for `MediaUrl`; the binary provides the HTTP one.
pub trait MediaFetcher: Send + Sync {
    fn fetch_media<'fetcher>(
        &'fetcher self,
        media_url: &'fetcher str,
        maximum_bytes: usize,
    ) -> Pin<Box<dyn Future<Output = Result<FetchedMedia, String>> + Send + 'fetcher>>;
}
