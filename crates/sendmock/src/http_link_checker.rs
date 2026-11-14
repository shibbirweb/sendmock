use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use sendmock_ops::{LinkChecker, LinkProbe, OperationContext};

const LINK_TIMEOUT: Duration = Duration::from_secs(10);

/// Requests a link as a mail client follows it: `HEAD` first, then `GET` when the server does
/// not answer `HEAD`, without following redirects, so the first redirect is reported.
pub struct HttpLinkChecker {
    http_client: reqwest::Client,
}

impl HttpLinkChecker {
    fn new() -> Option<Self> {
        let http_client = reqwest::Client::builder()
            .user_agent("sendmock link check")
            .timeout(LINK_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .ok()?;
        Some(Self { http_client })
    }

    async fn request_link(
        &self,
        method: reqwest::Method,
        link_url: &str,
    ) -> Result<reqwest::Response, reqwest::Error> {
        self.http_client.request(method, link_url).send().await
    }
}

/// The context with the link checker, when an HTTP client can be built.
pub fn with_http_link_checker(operation_context: OperationContext) -> OperationContext {
    match HttpLinkChecker::new() {
        Some(link_checker) => operation_context.with_link_checker(Arc::new(link_checker)),
        None => operation_context,
    }
}

impl LinkChecker for HttpLinkChecker {
    fn probe_link<'checker>(
        &'checker self,
        link_url: &'checker str,
    ) -> Pin<Box<dyn Future<Output = LinkProbe> + Send + 'checker>> {
        Box::pin(async move {
            let started_at = Instant::now();
            let mut answer = self.request_link(reqwest::Method::HEAD, link_url).await;
            let is_head_refused = answer
                .as_ref()
                .is_ok_and(|response| matches!(response.status().as_u16(), 405 | 501));
            if is_head_refused {
                answer = self.request_link(reqwest::Method::GET, link_url).await;
            }
            let duration_ms = u32::try_from(started_at.elapsed().as_millis()).ok();
            match answer {
                Ok(response) => LinkProbe {
                    status_code: Some(response.status().as_u16()),
                    redirect_url: response
                        .headers()
                        .get(reqwest::header::LOCATION)
                        .and_then(|location| location.to_str().ok())
                        .map(str::to_owned),
                    duration_ms,
                    error_message: None,
                },
                Err(request_error) => LinkProbe {
                    status_code: None,
                    redirect_url: None,
                    duration_ms,
                    error_message: Some(if request_error.is_timeout() {
                        "Timed out".to_owned()
                    } else {
                        request_error.to_string()
                    }),
                },
            }
        })
    }
}
