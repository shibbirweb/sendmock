use std::net::SocketAddr;

use sendmock_pop3::Pop3Login;

use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

/// `--pop3-addr` and `--pop3-auth`: the POP3 listener, off unless an address is given.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pop3Config {
    pub pop3_addr: SocketAddr,
    pub login: Pop3Login,
}

impl Pop3Config {
    pub fn resolve(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
    ) -> Result<Option<Self>, ConfigError> {
        let Some(pop3_addr) = serve_arguments.pop3_addr.or(config_file.pop3_addr) else {
            return Ok(None);
        };
        let login = match serve_arguments
            .pop3_auth
            .as_ref()
            .or(config_file.pop3_auth.as_ref())
        {
            Some(auth_setting) => Pop3Login::from_setting(auth_setting).map_err(|login_error| {
                ConfigError::InvalidSetting {
                    setting_name: "pop3_auth",
                    reason: login_error.to_string(),
                }
            })?,
            None => Pop3Login::AcceptAny,
        };
        Ok(Some(Self { pop3_addr, login }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pop3_is_off_until_an_address_is_given() -> Result<(), ConfigError> {
        let without_address =
            Pop3Config::resolve(&ServeArguments::default(), &ConfigFile::default())?;
        let serve_arguments = ServeArguments {
            pop3_addr: "127.0.0.1:1110".parse().ok(),
            ..ServeArguments::default()
        };
        let with_address = Pop3Config::resolve(&serve_arguments, &ConfigFile::default())?;

        assert_eq!(without_address, None);
        assert_eq!(
            with_address.map(|pop3_config| pop3_config.login),
            Some(Pop3Login::AcceptAny)
        );
        Ok(())
    }

    #[test]
    fn an_unknown_login_mode_is_refused() {
        let serve_arguments = ServeArguments {
            pop3_addr: "127.0.0.1:1110".parse().ok(),
            pop3_auth: Some("none".to_owned()),
            ..ServeArguments::default()
        };

        assert!(Pop3Config::resolve(&serve_arguments, &ConfigFile::default()).is_err());
    }
}
