use std::net::SocketAddr;

const DEFAULT_SERVER_URL: &str = "http://127.0.0.1:8025";

/// `--server` (or `SENDMOCK_SERVER`) wins; otherwise the address this machine's server is
/// configured to listen on, so `sendmock health` works inside the Docker image unchanged.
pub fn resolve_server_url(
    explicit_server_url: Option<&str>,
    http_addr_setting: Option<&str>,
) -> String {
    if let Some(server_url) = explicit_server_url {
        return server_url.trim_end_matches('/').to_owned();
    }
    match http_addr_setting.and_then(|setting| setting.parse::<SocketAddr>().ok()) {
        Some(http_addr) if http_addr.ip().is_unspecified() => {
            format!("http://127.0.0.1:{}", http_addr.port())
        }
        Some(http_addr) => format!("http://{http_addr}"),
        None => DEFAULT_SERVER_URL.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_explicit_server_wins() {
        assert_eq!(
            resolve_server_url(Some("http://sendmock:8025/"), Some("127.0.0.1:9000")),
            "http://sendmock:8025"
        );
    }

    #[test]
    fn follows_the_configured_listen_address() {
        assert_eq!(
            resolve_server_url(None, Some("127.0.0.1:9000")),
            "http://127.0.0.1:9000"
        );
    }

    #[test]
    fn reaches_a_server_listening_on_every_interface_through_localhost() {
        assert_eq!(
            resolve_server_url(None, Some("0.0.0.0:8025")),
            "http://127.0.0.1:8025"
        );
    }

    #[test]
    fn falls_back_to_the_default_port() {
        assert_eq!(resolve_server_url(None, None), "http://127.0.0.1:8025");
        assert_eq!(
            resolve_server_url(None, Some("not an address")),
            "http://127.0.0.1:8025"
        );
    }
}
