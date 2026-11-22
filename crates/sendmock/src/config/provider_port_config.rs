use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;

use super::ConfigError;
use super::config_file::ConfigFile;
use super::listener_setting::ListenerSetting;
use crate::cli_arguments::ServeArguments;

/// Provider SDKs reach SendMock here unless `--provider-addr` moves it or `none` turns it off.
pub const DEFAULT_PROVIDER_ADDR: SocketAddr =
    SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 8026);

/// The provider listeners: one for every provider at their real paths, and one per provider
/// given its own port.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProviderPortConfig {
    pub provider_addr: Option<SocketAddr>,
    /// True when nothing set the address, so a busy default port starts SendMock without it.
    pub is_default_provider_addr: bool,
    /// Bound on the provider address's host, or the HTTP address's host without one.
    pub dedicated_ports: Vec<(String, SocketAddr)>,
    /// The provider routes over HTTPS, when on.
    pub tls: Option<ProviderTlsConfig>,
}

/// `--provider-tls-addr` with its certificate: the user's files, or one from the local CA for
/// these extra names.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderTlsConfig {
    pub tls_addr: SocketAddr,
    pub certificate_file: Option<PathBuf>,
    pub key_file: Option<PathBuf>,
    pub extra_names: Vec<String>,
}

impl ProviderPortConfig {
    pub fn resolve(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
        http_addr: SocketAddr,
    ) -> Result<Self, ConfigError> {
        let provider_setting = serve_arguments.provider_addr.or(config_file.provider_addr);
        let configured_provider_addr = provider_setting.and_then(ListenerSetting::address);
        let host_address = configured_provider_addr.unwrap_or(http_addr).ip();
        let port_settings: Vec<(String, u16)> = if serve_arguments.provider_ports.is_empty() {
            config_file
                .provider_ports
                .clone()
                .unwrap_or_default()
                .into_iter()
                .collect()
        } else {
            serve_arguments
                .provider_ports
                .iter()
                .map(|port_setting| parse_port_setting(port_setting))
                .collect::<Result<_, _>>()?
        };
        let tls = serve_arguments
            .provider_tls_addr
            .or(config_file.provider_tls_addr)
            .map(|tls_addr| ProviderTlsConfig {
                tls_addr,
                certificate_file: serve_arguments
                    .provider_tls_cert
                    .clone()
                    .or_else(|| config_file.provider_tls_cert.clone()),
                key_file: serve_arguments
                    .provider_tls_key
                    .clone()
                    .or_else(|| config_file.provider_tls_key.clone()),
                extra_names: if serve_arguments.provider_tls_names.is_empty() {
                    config_file.provider_tls_names.clone().unwrap_or_default()
                } else {
                    serve_arguments.provider_tls_names.clone()
                },
            });
        Ok(Self {
            provider_addr: match provider_setting {
                Some(setting) => setting.address(),
                None => Some(DEFAULT_PROVIDER_ADDR),
            },
            is_default_provider_addr: provider_setting.is_none(),
            tls,
            dedicated_ports: port_settings
                .into_iter()
                .map(|(provider_key, port)| (provider_key, SocketAddr::new(host_address, port)))
                .collect(),
        })
    }
}

/// `twilio=8027`.
fn parse_port_setting(port_setting: &str) -> Result<(String, u16), ConfigError> {
    let invalid_setting = || ConfigError::InvalidSetting {
        setting_name: "provider_port",
        reason: format!("{port_setting} is not provider=port, such as twilio=8027"),
    };
    let (provider_key, port_text) = port_setting.split_once('=').ok_or_else(invalid_setting)?;
    let provider_key = provider_key.trim();
    let port = port_text
        .trim()
        .parse::<u16>()
        .map_err(|_| invalid_setting())?;
    if provider_key.is_empty() {
        return Err(invalid_setting());
    }
    Ok((provider_key.to_owned(), port))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolve_provider_ports(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
    ) -> ProviderPortConfig {
        ProviderPortConfig::resolve(serve_arguments, config_file, http_addr())
            .unwrap_or_else(|config_error| panic!("{config_error}"))
    }

    // AC: PL-24.1
    #[test]
    fn the_provider_port_is_on_by_default_at_8026() {
        let provider_ports =
            resolve_provider_ports(&ServeArguments::default(), &ConfigFile::default());

        assert_eq!(provider_ports.provider_addr, Some(DEFAULT_PROVIDER_ADDR));
        assert!(provider_ports.is_default_provider_addr);
    }

    // AC: PL-24.1
    #[test]
    fn none_from_the_flag_or_the_file_turns_it_off() {
        let off_by_flag = resolve_provider_ports(
            &ServeArguments {
                provider_addr: Some(ListenerSetting::Off),
                ..ServeArguments::default()
            },
            &ConfigFile::default(),
        );
        let off_by_file = resolve_provider_ports(
            &ServeArguments::default(),
            &ConfigFile {
                provider_addr: Some(ListenerSetting::Off),
                ..ConfigFile::default()
            },
        );

        assert_eq!(off_by_flag.provider_addr, None);
        assert_eq!(off_by_file.provider_addr, None);
        assert!(!off_by_flag.is_default_provider_addr);
    }

    #[test]
    fn a_set_address_is_not_the_default() {
        let provider_ports = resolve_provider_ports(
            &ServeArguments {
                provider_addr: "127.0.0.1:9026".parse().ok(),
                ..ServeArguments::default()
            },
            &ConfigFile::default(),
        );

        assert_eq!(provider_ports.provider_addr, "127.0.0.1:9026".parse().ok());
        assert!(!provider_ports.is_default_provider_addr);
    }

    const HTTP_ADDR: &str = "127.0.0.1:8025";

    fn http_addr() -> SocketAddr {
        HTTP_ADDR.parse().unwrap_or_else(|error| panic!("{error}"))
    }

    // AC: SM-14.3
    #[test]
    fn a_provider_port_binds_on_the_provider_host() {
        let serve_arguments = ServeArguments {
            provider_addr: "0.0.0.0:8026".parse().ok(),
            provider_ports: vec!["twilio=8027".to_owned(), " vonage = 8028 ".to_owned()],
            ..ServeArguments::default()
        };

        let provider_ports =
            ProviderPortConfig::resolve(&serve_arguments, &ConfigFile::default(), http_addr());

        assert_eq!(
            provider_ports.ok().map(|config| config.dedicated_ports),
            Some(vec![
                (
                    "twilio".to_owned(),
                    "0.0.0.0:8027"
                        .parse()
                        .unwrap_or_else(|error| panic!("{error}"))
                ),
                (
                    "vonage".to_owned(),
                    "0.0.0.0:8028"
                        .parse()
                        .unwrap_or_else(|error| panic!("{error}"))
                ),
            ])
        );
    }

    #[test]
    fn the_file_gives_ports_and_bad_settings_are_refused() {
        let config_file = ConfigFile {
            provider_ports: Some([("twilio".to_owned(), 9027)].into_iter().collect()),
            ..ConfigFile::default()
        };
        let bad_arguments = ServeArguments {
            provider_ports: vec!["twilio:8027".to_owned()],
            ..ServeArguments::default()
        };

        let from_file =
            ProviderPortConfig::resolve(&ServeArguments::default(), &config_file, http_addr());

        assert_eq!(
            from_file
                .ok()
                .map(|config| (config.provider_addr, config.dedicated_ports.len())),
            Some((Some(DEFAULT_PROVIDER_ADDR), 1))
        );
        assert!(
            ProviderPortConfig::resolve(&bad_arguments, &ConfigFile::default(), http_addr())
                .is_err()
        );
    }
}
