use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use sendmock_ops::{FetchedMedia, MediaFetcher};

const FETCH_TIMEOUT: Duration = Duration::from_secs(10);

/// Downloads `MediaUrl` links over HTTP or HTTPS, as Twilio does before sending an MMS.
pub struct HttpMediaFetcher {
    http_client: reqwest::Client,
}

impl HttpMediaFetcher {
    /// `None` when no HTTP client can be built; media links then fail with Twilio's 11200.
    pub fn new() -> Option<Self> {
        let http_client = reqwest::Client::builder()
            .user_agent("sendmock")
            .timeout(FETCH_TIMEOUT)
            .build()
            .ok()?;
        Some(Self { http_client })
    }
}

impl MediaFetcher for HttpMediaFetcher {
    fn fetch_media<'fetcher>(
        &'fetcher self,
        media_url: &'fetcher str,
        maximum_bytes: usize,
    ) -> Pin<Box<dyn Future<Output = Result<FetchedMedia, String>> + Send + 'fetcher>> {
        Box::pin(async move {
            let response = self
                .http_client
                .get(media_url)
                .send()
                .await
                .and_then(reqwest::Response::error_for_status)
                .map_err(|request_error| request_error.to_string())?;
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|header_value| header_value.to_str().ok())
                .map(|content_type| {
                    content_type
                        .split(';')
                        .next()
                        .unwrap_or(content_type)
                        .trim()
                        .to_owned()
                });
            let bytes = response
                .bytes()
                .await
                .map_err(|read_error| read_error.to_string())?;
            if bytes.len() > maximum_bytes {
                return Err(format!("the file is larger than {maximum_bytes} bytes"));
            }
            Ok(FetchedMedia {
                content_type,
                bytes: bytes.to_vec(),
            })
        })
    }
}
