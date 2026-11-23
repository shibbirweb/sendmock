use std::fmt;
use std::net::SocketAddr;
use std::str::FromStr;

use serde::{Deserialize, Deserializer};

/// The word that turns off a listener that is on by default.
pub const LISTENER_OFF_WORD: &str = "none";

/// A listener's address from a flag, variable or `sendmock.toml`, or `none` to keep it off.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListenerSetting {
    Address(SocketAddr),
    Off,
}

impl ListenerSetting {
    /// The address to listen on, or `None` when the listener is off.
    pub fn address(self) -> Option<SocketAddr> {
        match self {
            Self::Address(address) => Some(address),
            Self::Off => None,
        }
    }
}

impl FromStr for ListenerSetting {
    type Err = String;

    fn from_str(setting_text: &str) -> Result<Self, Self::Err> {
        let trimmed_setting = setting_text.trim();
        if trimmed_setting.eq_ignore_ascii_case(LISTENER_OFF_WORD) {
            return Ok(Self::Off);
        }
        trimmed_setting
            .parse()
            .map(Self::Address)
            .map_err(|_| format!("{trimmed_setting} is not HOST:PORT or {LISTENER_OFF_WORD}"))
    }
}

impl fmt::Display for ListenerSetting {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Address(address) => write!(formatter, "{address}"),
            Self::Off => formatter.write_str(LISTENER_OFF_WORD),
        }
    }
}

impl<'de> Deserialize<'de> for ListenerSetting {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let setting_text = String::deserialize(deserializer)?;
        setting_text.parse().map_err(serde::de::Error::custom)
    }
}

/// For clap: `127.0.0.1:8026` or `none`.
pub fn parse_listener_setting(setting_text: &str) -> Result<ListenerSetting, String> {
    setting_text.parse()
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-24.1
    #[test]
    fn none_turns_the_listener_off_and_an_address_turns_it_on() {
        assert_eq!(parse_listener_setting("none"), Ok(ListenerSetting::Off));
        assert_eq!(parse_listener_setting(" NONE "), Ok(ListenerSetting::Off));
        assert_eq!(
            parse_listener_setting("127.0.0.1:9026").map(ListenerSetting::address),
            Ok("127.0.0.1:9026".parse().ok())
        );
    }

    #[test]
    fn anything_else_is_refused_with_both_forms_named() {
        let parse_error = parse_listener_setting("off").err().unwrap_or_default();

        assert!(parse_error.contains("HOST:PORT"));
        assert!(parse_error.contains("none"));
    }

    #[test]
    fn it_prints_as_it_is_written() {
        assert_eq!(ListenerSetting::Off.to_string(), "none");
        assert_eq!(
            parse_listener_setting("127.0.0.1:8026").map(|setting| setting.to_string()),
            Ok("127.0.0.1:8026".to_owned())
        );
    }
}
