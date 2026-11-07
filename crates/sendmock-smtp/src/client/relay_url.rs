/// The login a relay URL carries in `user:password@`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayCredentials {
    pub user_name: String,
    pub password: String,
}

/// `smtp://[user:password@]host[:port]` (STARTTLS when offered, port 25 by default) or
/// `smtps://...` (TLS from the first byte, port 465 by default).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayUrl {
    pub is_implicit_tls: bool,
    pub host: String,
    pub port: u16,
    pub credentials: Option<RelayCredentials>,
}

impl RelayUrl {
    pub fn parse(relay_url: &str) -> Result<Self, String> {
        let (scheme, rest) = relay_url
            .split_once("://")
            .ok_or_else(|| "the relay URL needs smtp:// or smtps://".to_owned())?;
        let is_implicit_tls = match scheme.to_ascii_lowercase().as_str() {
            "smtp" => false,
            "smtps" => true,
            _ => return Err(format!("{scheme}:// is not smtp:// or smtps://")),
        };
        let authority = rest.split(['/', '?']).next().unwrap_or_default();
        let (credentials, host_and_port) = match authority.rsplit_once('@') {
            Some((login, host_and_port)) => (Some(parse_credentials(login)), host_and_port),
            None => (None, authority),
        };
        let default_port = if is_implicit_tls { 465 } else { 25 };
        let (host, port) = match host_and_port.rsplit_once(':') {
            Some((host, port_text)) => (
                host,
                port_text
                    .parse()
                    .map_err(|_| format!("{port_text} is not a port"))?,
            ),
            None => (host_and_port, default_port),
        };
        if host.is_empty() {
            return Err("the relay URL has no host".to_owned());
        }
        Ok(Self {
            is_implicit_tls,
            host: host.to_owned(),
            port,
            credentials,
        })
    }

    /// Passwords only travel over TLS, except to a relay on this machine.
    pub fn is_loopback(&self) -> bool {
        matches!(
            self.host.as_str(),
            "localhost" | "127.0.0.1" | "::1" | "[::1]"
        )
    }
}

fn parse_credentials(login: &str) -> RelayCredentials {
    let (user_name, password) = login.split_once(':').unwrap_or((login, ""));
    RelayCredentials {
        user_name: decode_percent_escapes(user_name),
        password: decode_percent_escapes(password),
    }
}

/// `%40` and the like, as a URL writes an `@` or `:` inside a user name or password.
fn decode_percent_escapes(encoded_text: &str) -> String {
    let encoded_bytes = encoded_text.as_bytes();
    let mut decoded_bytes = Vec::with_capacity(encoded_bytes.len());
    let mut byte_index = 0;
    while byte_index < encoded_bytes.len() {
        let escaped_byte = encoded_text
            .get(byte_index + 1..byte_index + 3)
            .filter(|_| encoded_bytes[byte_index] == b'%')
            .and_then(|hex_digits| u8::from_str_radix(hex_digits, 16).ok());
        match escaped_byte {
            Some(decoded_byte) => {
                decoded_bytes.push(decoded_byte);
                byte_index += 3;
            }
            None => {
                decoded_bytes.push(encoded_bytes[byte_index]);
                byte_index += 1;
            }
        }
    }
    String::from_utf8_lossy(&decoded_bytes).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_scheme_login_host_and_port() {
        assert_eq!(
            RelayUrl::parse("smtp://mailer:p%40ss@smtp.example.test:587"),
            Ok(RelayUrl {
                is_implicit_tls: false,
                host: "smtp.example.test".to_owned(),
                port: 587,
                credentials: Some(RelayCredentials {
                    user_name: "mailer".to_owned(),
                    password: "p@ss".to_owned(),
                }),
            })
        );
        assert_eq!(
            RelayUrl::parse("smtps://relay.example.test").map(|relay_url| relay_url.port),
            Ok(465)
        );
        assert_eq!(
            RelayUrl::parse("smtp://relay.example.test").map(|relay_url| relay_url.credentials),
            Ok(None)
        );
    }

    #[test]
    fn refuses_other_schemes_and_missing_hosts() {
        assert!(RelayUrl::parse("https://relay.example.test").is_err());
        assert!(RelayUrl::parse("smtp://:25").is_err());
        assert!(RelayUrl::parse("relay.example.test").is_err());
    }
}
