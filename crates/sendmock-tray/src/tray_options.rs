use std::path::PathBuf;

/// Where SendMock is expected unless `--url` or `SENDMOCK_URL` says otherwise.
pub const DEFAULT_SENDMOCK_URL: &str = "http://127.0.0.1:8025";

/// What the tray app was started with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayOptions {
    /// The web UI and API address, such as `http://127.0.0.1:8025`.
    pub sendmock_url: String,
    /// The `sendmock` binary to start; found beside the tray app or on `PATH` when not given.
    pub sendmock_binary: Option<PathBuf>,
}

impl TrayOptions {
    /// Reads `--url <url>` and `--sendmock <path>`; `SENDMOCK_URL` stands in for `--url`.
    pub fn from_arguments(
        arguments: impl IntoIterator<Item = String>,
        sendmock_url_variable: Option<String>,
    ) -> Result<Self, String> {
        let mut tray_options = Self {
            sendmock_url: sendmock_url_variable
                .filter(|url| !url.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_SENDMOCK_URL.to_owned()),
            sendmock_binary: None,
        };
        let mut arguments = arguments.into_iter();
        while let Some(argument) = arguments.next() {
            let mut read_value = || {
                arguments
                    .next()
                    .ok_or_else(|| format!("{argument} needs a value"))
            };
            match argument.as_str() {
                "--url" => tray_options.sendmock_url = read_value()?,
                "--sendmock" => tray_options.sendmock_binary = Some(PathBuf::from(read_value()?)),
                _ => {
                    return Err(format!(
                        "unknown option {argument}; use --url or --sendmock"
                    ));
                }
            }
        }
        tray_options.sendmock_url = tray_options.sendmock_url.trim_end_matches('/').to_owned();
        Ok(tray_options)
    }

    /// The `host:port` the URL names, for `sendmock serve --http-addr`.
    pub fn read_http_address(&self) -> Option<String> {
        let without_scheme = self.sendmock_url.strip_prefix("http://")?;
        let host_and_port = without_scheme.split('/').next()?;
        host_and_port
            .contains(':')
            .then(|| host_and_port.to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owned(arguments: &[&str]) -> Vec<String> {
        arguments
            .iter()
            .map(|argument| (*argument).to_owned())
            .collect()
    }

    #[test]
    fn the_url_comes_from_the_flag_then_the_variable_then_the_default() {
        let from_flag = TrayOptions::from_arguments(
            owned(&["--url", "http://127.0.0.1:9000/"]),
            Some("http://10.0.0.1:8025".to_owned()),
        );
        let from_variable =
            TrayOptions::from_arguments(owned(&[]), Some("http://10.0.0.1:8025".to_owned()));
        let by_default = TrayOptions::from_arguments(owned(&[]), None);

        assert_eq!(
            from_flag.map(|options| options.sendmock_url),
            Ok("http://127.0.0.1:9000".to_owned())
        );
        assert_eq!(
            from_variable.map(|options| options.sendmock_url),
            Ok("http://10.0.0.1:8025".to_owned())
        );
        assert_eq!(
            by_default.map(|options| options.sendmock_url),
            Ok(DEFAULT_SENDMOCK_URL.to_owned())
        );
    }

    #[test]
    fn the_binary_path_is_read_and_unknown_or_incomplete_options_are_refused() {
        let with_binary =
            TrayOptions::from_arguments(owned(&["--sendmock", "/opt/sendmock"]), None);

        assert_eq!(
            with_binary.map(|options| options.sendmock_binary),
            Ok(Some(PathBuf::from("/opt/sendmock")))
        );
        assert!(TrayOptions::from_arguments(owned(&["--port"]), None).is_err());
        assert!(TrayOptions::from_arguments(owned(&["--url"]), None).is_err());
    }

    #[test]
    fn the_http_address_is_the_urls_host_and_port() {
        let tray_options =
            TrayOptions::from_arguments(owned(&["--url", "http://127.0.0.1:9000"]), None);

        assert_eq!(
            tray_options
                .ok()
                .and_then(|options| options.read_http_address()),
            Some("127.0.0.1:9000".to_owned())
        );
    }
}
