use std::fmt;
use std::net::{IpAddr, SocketAddr};

use sendmock_ops::{
    FetchedSetupFile, SetupFetchError, SetupFetchFuture, SetupFetchLimits, SetupFetchRequest,
    SetupFetcher, is_plain_http_address_allowed,
};

/// Downloads setup files over https, or plain http to loopback and private addresses, within
/// the fetch limits. A client is built per download, so a plain http host is pinned to the
/// addresses that were checked.
pub struct HttpSetupFetcher;

impl SetupFetcher for HttpSetupFetcher {
    fn fetch_setup<'fetcher>(
        &'fetcher self,
        fetch_request: &'fetcher SetupFetchRequest,
    ) -> SetupFetchFuture<'fetcher> {
        Box::pin(fetch_setup_file(fetch_request))
    }
}

async fn fetch_setup_file(
    fetch_request: &SetupFetchRequest,
) -> Result<FetchedSetupFile, SetupFetchError> {
    let setup_url =
        reqwest::Url::parse(fetch_request.url.trim()).map_err(|_| SetupFetchError::InvalidUrl {
            url: fetch_request.url.clone(),
        })?;
    let limits = &fetch_request.limits;
    let http_client = build_http_client(&setup_url, limits).await?;
    let mut request_builder = http_client.get(setup_url);
    for request_header in &fetch_request.headers {
        request_builder = request_builder.header(&request_header.name, &request_header.value);
    }
    let response = request_builder
        .send()
        .await
        .map_err(|request_error| describe_request_error(request_error, limits))?;
    if !response.status().is_success() {
        return Err(SetupFetchError::UnsuccessfulStatus {
            status_code: response.status().as_u16(),
        });
    }
    read_limited_body(response, limits).await
}

async fn build_http_client(
    setup_url: &reqwest::Url,
    limits: &SetupFetchLimits,
) -> Result<reqwest::Client, SetupFetchError> {
    let mut client_builder = reqwest::Client::builder()
        .user_agent("sendmock")
        .timeout(limits.timeout)
        .redirect(build_redirect_policy(limits.maximum_redirects));
    match setup_url.scheme() {
        "https" => {}
        "http" => client_builder = pin_private_addresses(client_builder, setup_url, limits).await?,
        _ => return Err(SetupFetchError::NotHttps),
    }
    client_builder
        .build()
        .map_err(|build_error| SetupFetchError::Unreachable {
            reason: build_error.to_string(),
        })
}

/// Plain http goes ahead only when every address of the host is loopback or private.
async fn pin_private_addresses(
    client_builder: reqwest::ClientBuilder,
    setup_url: &reqwest::Url,
    limits: &SetupFetchLimits,
) -> Result<reqwest::ClientBuilder, SetupFetchError> {
    let host_text = setup_url.host_str().unwrap_or_default();
    let bare_host = host_text.trim_start_matches('[').trim_end_matches(']');
    let refused_host = || SetupFetchError::PlainHttpNotPrivate {
        host: bare_host.to_owned(),
    };
    if let Ok(ip_address) = bare_host.parse::<IpAddr>() {
        return if is_plain_http_address_allowed(ip_address) {
            Ok(client_builder)
        } else {
            Err(refused_host())
        };
    }
    let port = setup_url.port_or_known_default().unwrap_or(80);
    let unknown_host = || SetupFetchError::UnknownHost {
        host: bare_host.to_owned(),
    };
    let host_addresses: Vec<SocketAddr> =
        tokio::time::timeout(limits.timeout, tokio::net::lookup_host((bare_host, port)))
            .await
            .map_err(|_| SetupFetchError::TimedOut {
                timeout_seconds: limits.timeout.as_secs(),
            })?
            .map_err(|_| unknown_host())?
            .collect();
    if host_addresses.is_empty() {
        return Err(unknown_host());
    }
    if !host_addresses
        .iter()
        .all(|host_address| is_plain_http_address_allowed(host_address.ip()))
    {
        return Err(refused_host());
    }
    Ok(client_builder.resolve_to_addrs(bare_host, &host_addresses))
}

/// Why a redirect was not followed, carried through reqwest's error to `describe_request_error`.
#[derive(Debug)]
enum RedirectRefusal {
    TooMany,
    NotHttps,
}

impl fmt::Display for RedirectRefusal {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::TooMany => formatter.write_str("too many redirects"),
            Self::NotHttps => formatter.write_str("a redirect to a URL that is not https"),
        }
    }
}

impl std::error::Error for RedirectRefusal {}

fn build_redirect_policy(maximum_redirects: usize) -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(move |redirect_attempt| {
        if redirect_attempt.previous().len() > maximum_redirects {
            redirect_attempt.error(RedirectRefusal::TooMany)
        } else if redirect_attempt.url().scheme() != "https" {
            redirect_attempt.error(RedirectRefusal::NotHttps)
        } else {
            redirect_attempt.follow()
        }
    })
}

/// The URL is left out of the message, as its query may carry a token.
fn describe_request_error(
    request_error: reqwest::Error,
    limits: &SetupFetchLimits,
) -> SetupFetchError {
    match find_redirect_refusal(&request_error) {
        Some(RedirectRefusal::TooMany) => {
            return SetupFetchError::TooManyRedirects {
                maximum_redirects: limits.maximum_redirects,
            };
        }
        Some(RedirectRefusal::NotHttps) => return SetupFetchError::RedirectNotHttps,
        None => {}
    }
    if request_error.is_timeout() {
        return SetupFetchError::TimedOut {
            timeout_seconds: limits.timeout.as_secs(),
        };
    }
    SetupFetchError::Unreachable {
        reason: request_error.without_url().to_string(),
    }
}

fn find_redirect_refusal(request_error: &reqwest::Error) -> Option<&RedirectRefusal> {
    let mut error_source = std::error::Error::source(request_error);
    while let Some(source_error) = error_source {
        if let Some(redirect_refusal) = source_error.downcast_ref::<RedirectRefusal>() {
            return Some(redirect_refusal);
        }
        error_source = source_error.source();
    }
    None
}

/// Stops reading as soon as the body passes the cap, whatever the server said its length was.
async fn read_limited_body(
    mut response: reqwest::Response,
    limits: &SetupFetchLimits,
) -> Result<FetchedSetupFile, SetupFetchError> {
    let maximum_bytes = limits.maximum_bytes;
    let too_large = || SetupFetchError::TooLarge { maximum_bytes };
    let declared_too_large = response.content_length().is_some_and(|content_length| {
        content_length > u64::try_from(maximum_bytes).unwrap_or(u64::MAX)
    });
    if declared_too_large {
        return Err(too_large());
    }
    let final_url = response.url().to_string();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|header_value| header_value.to_str().ok())
        .map(str::to_owned);
    let mut file_bytes = Vec::new();
    while let Some(body_chunk) = response
        .chunk()
        .await
        .map_err(|read_error| describe_request_error(read_error, limits))?
    {
        if file_bytes.len() + body_chunk.len() > maximum_bytes {
            return Err(too_large());
        }
        file_bytes.extend_from_slice(&body_chunk);
    }
    Ok(FetchedSetupFile {
        bytes: file_bytes,
        final_url,
        content_type,
    })
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use sendmock_ops::SetupRequestHeader;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::*;

    const SETUP_TOML: &str = "[[numbers]]\nnumber = \"+15550001111\"\n";

    /// A local HTTP server with one canned answer per path; keeps each request's head.
    struct LocalSetupServer {
        base_url: String,
        request_heads: Arc<Mutex<Vec<String>>>,
    }

    async fn start_local_server() -> LocalSetupServer {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .unwrap_or_else(|error| panic!("a local port: {error}"));
        let port = listener
            .local_addr()
            .map(|local_address| local_address.port())
            .unwrap_or_default();
        let request_heads = Arc::new(Mutex::new(Vec::new()));
        let recorded_heads = Arc::clone(&request_heads);
        tokio::spawn(async move {
            while let Ok((mut connection, _)) = listener.accept().await {
                let recorded_heads = Arc::clone(&recorded_heads);
                tokio::spawn(async move {
                    let mut request_bytes = vec![0_u8; 4096];
                    let read_length = connection.read(&mut request_bytes).await.unwrap_or(0);
                    let request_head =
                        String::from_utf8_lossy(&request_bytes[..read_length]).into_owned();
                    let request_path = request_head.split(' ').nth(1).unwrap_or("/").to_owned();
                    if let Ok(mut heads) = recorded_heads.lock() {
                        heads.push(request_head);
                    }
                    if request_path == "/slow" {
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                    let answer = build_answer(&request_path, port);
                    let _ = connection.write_all(answer.as_bytes()).await;
                    let _ = connection.shutdown().await;
                });
            }
        });
        LocalSetupServer {
            base_url: format!("http://127.0.0.1:{port}"),
            request_heads,
        }
    }

    fn build_answer(request_path: &str, port: u16) -> String {
        let redirect_to = |location: String| {
            format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\n\r\n")
        };
        match request_path {
            "/setup.toml" => format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\n\r\n{SETUP_TOML}",
                SETUP_TOML.len()
            ),
            "/large-declared" => "HTTP/1.1 200 OK\r\nContent-Length: 5000\r\n\r\n".to_owned(),
            "/large-streamed" => format!(
                "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n{}",
                "x".repeat(5000)
            ),
            "/to-http" => redirect_to(format!("http://127.0.0.1:{port}/setup.toml")),
            "/to-https" => redirect_to(format!("https://127.0.0.1:{port}/setup.toml")),
            _ => "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".to_owned(),
        }
    }

    fn test_limits() -> SetupFetchLimits {
        SetupFetchLimits {
            maximum_bytes: 1000,
            timeout: Duration::from_millis(500),
            maximum_redirects: 3,
        }
    }

    async fn fetch(
        url: String,
        limits: SetupFetchLimits,
    ) -> Result<FetchedSetupFile, SetupFetchError> {
        crate::tls_provider::install_tls_provider();
        let fetch_request = SetupFetchRequest {
            url,
            headers: vec![
                SetupRequestHeader::parse("Authorization: Bearer abc123")
                    .unwrap_or_else(|error| panic!("a header: {error}")),
            ],
            limits,
        };
        HttpSetupFetcher.fetch_setup(&fetch_request).await
    }

    // AC: PL-18.7
    #[tokio::test]
    async fn downloads_a_setup_from_a_loopback_address_with_its_headers() {
        let local_server = start_local_server().await;

        let fetched_file = fetch(
            format!("{}/setup.toml", local_server.base_url),
            test_limits(),
        )
        .await
        .unwrap_or_else(|error| panic!("downloads: {error}"));

        assert_eq!(fetched_file.bytes, SETUP_TOML.as_bytes());
        assert_eq!(fetched_file.content_type.as_deref(), Some("text/plain"));
        assert!(fetched_file.final_url.ends_with("/setup.toml"));
        let request_heads = local_server
            .request_heads
            .lock()
            .map(|heads| heads.join("\n").to_ascii_lowercase())
            .unwrap_or_default();
        assert!(
            request_heads.contains("authorization: bearer abc123"),
            "{request_heads}"
        );
    }

    // AC: PL-18.7
    #[tokio::test]
    async fn refuses_a_file_over_the_cap_whether_declared_or_streamed() {
        let local_server = start_local_server().await;

        for request_path in ["/large-declared", "/large-streamed"] {
            let fetch_result = fetch(
                format!("{}{request_path}", local_server.base_url),
                test_limits(),
            )
            .await;

            assert_eq!(
                fetch_result,
                Err(SetupFetchError::TooLarge {
                    maximum_bytes: 1000
                }),
                "{request_path}"
            );
        }
    }

    // AC: PL-18.7
    #[tokio::test]
    async fn gives_up_after_the_timeout() {
        let local_server = start_local_server().await;

        let fetch_result = fetch(format!("{}/slow", local_server.base_url), test_limits()).await;

        assert!(
            matches!(fetch_result, Err(SetupFetchError::TimedOut { .. })),
            "{fetch_result:?}"
        );
    }

    // AC: PL-18.7
    #[tokio::test]
    async fn follows_redirects_only_to_https_and_only_so_many() {
        let local_server = start_local_server().await;
        let no_redirects = SetupFetchLimits {
            maximum_redirects: 0,
            ..test_limits()
        };

        let to_http = fetch(format!("{}/to-http", local_server.base_url), test_limits()).await;
        let too_many = fetch(format!("{}/to-https", local_server.base_url), no_redirects).await;

        assert_eq!(to_http, Err(SetupFetchError::RedirectNotHttps));
        assert_eq!(
            too_many,
            Err(SetupFetchError::TooManyRedirects {
                maximum_redirects: 0
            })
        );
    }

    // AC: PL-18.7
    #[tokio::test]
    async fn refuses_plain_http_to_a_public_address_and_other_schemes() {
        let public_http = fetch("http://203.0.113.1/setup.toml".to_owned(), test_limits()).await;
        let other_scheme = fetch("ftp://example.com/setup.toml".to_owned(), test_limits()).await;
        let not_a_url = fetch("not a url".to_owned(), test_limits()).await;

        assert_eq!(
            public_http,
            Err(SetupFetchError::PlainHttpNotPrivate {
                host: "203.0.113.1".to_owned()
            })
        );
        assert_eq!(other_scheme, Err(SetupFetchError::NotHttps));
        assert!(matches!(not_a_url, Err(SetupFetchError::InvalidUrl { .. })));
    }

    #[tokio::test]
    async fn names_the_status_of_an_unsuccessful_answer() {
        let local_server = start_local_server().await;

        let fetch_result = fetch(format!("{}/missing", local_server.base_url), test_limits()).await;

        assert_eq!(
            fetch_result,
            Err(SetupFetchError::UnsuccessfulStatus { status_code: 404 })
        );
    }
}
