use std::net::SocketAddr;

use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

/// The provider listeners: one for every provider at their real paths, and one per provider
/// given its own port.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProviderPortConfig {
    pub provider_addr: Option<SocketAddr>,
    /// Bound on the provider address's host, or the HTTP address's host without one.
    pub dedicated_ports: Vec<(String, SocketAddr)>,
}

impl ProviderPortConfig {
    pub fn resolve(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
        http_addr: SocketAddr,
    ) -> Result<Self, ConfigError> {
        let provider_addr = serve_arguments.provider_addr.or(config_file.provider_addr);
        let host_address = provider_addr.unwrap_or(http_addr).ip();
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
        Ok(Self {
            provider_addr,
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
            Some((None, 1))
        );
        assert!(
            ProviderPortConfig::resolve(&bad_arguments, &ConfigFile::default(), http_addr())
                .is_err()
        );
    }
}
