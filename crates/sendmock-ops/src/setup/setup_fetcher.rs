use std::fmt;
use std::future::Future;
use std::net::IpAddr;
use std::pin::Pin;
use std::time::Duration;

use super::setup_fetch_error::SetupFetchError;
use crate::OperationError;

/// How far a setup download may go: 1 MB, 10 seconds and 3 redirects, all to https.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SetupFetchLimits {
    pub maximum_bytes: usize,
    pub timeout: Duration,
    pub maximum_redirects: usize,
}

impl Default for SetupFetchLimits {
    fn default() -> Self {
        Self {
            maximum_bytes: 1024 * 1024,
            timeout: Duration::from_secs(10),
            maximum_redirects: 3,
        }
    }
}

/// A header sent with a setup download, such as `Authorization` for a private URL. Its value
/// never appears in a log, an error or debug output.
#[derive(Clone, PartialEq, Eq)]
pub struct SetupRequestHeader {
    pub name: String,
    pub value: String,
}

impl SetupRequestHeader {
    /// Reads `--header "Authorization: Bearer ..."`.
    pub fn parse(header_line: &str) -> Result<Self, OperationError> {
        let invalid_header = |message: String| OperationError::InvalidInput {
            message,
            field: Some("headers".to_owned()),
        };
        let (name, value) = header_line
            .split_once(':')
            .ok_or_else(|| invalid_header("Write each header as Name: value".to_owned()))?;
        let name = name.trim();
        let value = value.trim();
        let is_token_name = !name.is_empty()
            && name.chars().all(|character| {
                character.is_ascii_alphanumeric() || "!#$%&'*+-.^_`|~".contains(character)
            });
        if !is_token_name {
            return Err(invalid_header(format!("{name} is not a header name")));
        }
        if value.is_empty() || value.contains(['\r', '\n']) {
            return Err(invalid_header(format!("{name} needs a value on one line")));
        }
        Ok(Self {
            name: name.to_owned(),
            value: value.to_owned(),
        })
    }

    /// `Authorization: ••••`, for logs and messages.
    pub fn describe_masked(&self) -> String {
        format!("{}: ••••", self.name)
    }
}

impl fmt::Debug for SetupRequestHeader {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.describe_masked())
    }
}

/// One setup download: the URL, its headers and the limits it must keep to.
#[derive(Debug, Clone)]
pub struct SetupFetchRequest {
    pub url: String,
    pub headers: Vec<SetupRequestHeader>,
    pub limits: SetupFetchLimits,
}

/// What a setup URL answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchedSetupFile {
    pub bytes: Vec<u8>,
    /// The URL after redirects, whose name may say the format.
    pub final_url: String,
    pub content_type: Option<String>,
}

/// What a setup fetch answers.
pub type SetupFetchFuture<'fetcher> =
    Pin<Box<dyn Future<Output = Result<FetchedSetupFile, SetupFetchError>> + Send + 'fetcher>>;

/// Downloads a setup file from a URL within its limits; the binary provides the HTTP one.
pub trait SetupFetcher: Send + Sync {
    fn fetch_setup<'fetcher>(
        &'fetcher self,
        fetch_request: &'fetcher SetupFetchRequest,
    ) -> SetupFetchFuture<'fetcher>;
}

/// Whether plain http may reach this address: loopback and private networks only, for a file
/// served inside a CI network. Link-local addresses are left out, as cloud metadata services
/// answer there.
pub fn is_plain_http_address_allowed(ip_address: IpAddr) -> bool {
    match ip_address {
        IpAddr::V4(ipv4_address) => ipv4_address.is_loopback() || ipv4_address.is_private(),
        IpAddr::V6(ipv6_address) => {
            if let Some(mapped_address) = ipv6_address.to_ipv4_mapped() {
                return is_plain_http_address_allowed(IpAddr::V4(mapped_address));
            }
            let is_unique_local = (ipv6_address.segments()[0] & 0xfe00) == 0xfc00;
            ipv6_address.is_loopback() || is_unique_local
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_address(address_text: &str) -> IpAddr {
        address_text
            .parse()
            .unwrap_or_else(|error| panic!("{address_text}: {error}"))
    }

    // AC: PL-18.7
    #[test]
    fn plain_http_reaches_only_loopback_and_private_addresses() {
        for allowed_address in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.9",
            "192.168.1.20",
            "::1",
            "fd00::5",
            "::ffff:192.168.1.20",
        ] {
            assert!(
                is_plain_http_address_allowed(parse_address(allowed_address)),
                "{allowed_address}"
            );
        }
        for refused_address in [
            "203.0.113.1",
            "8.8.8.8",
            "169.254.169.254",
            "2001:db8::1",
            "fe80::1",
            "::ffff:8.8.8.8",
        ] {
            assert!(
                !is_plain_http_address_allowed(parse_address(refused_address)),
                "{refused_address}"
            );
        }
    }

    // AC: PL-18.7
    #[test]
    fn a_header_value_never_shows_in_debug_output() {
        let header = SetupRequestHeader::parse("Authorization: Bearer abc123")
            .unwrap_or_else(|error| panic!("a header: {error}"));

        assert_eq!(header.name, "Authorization");
        assert_eq!(header.value, "Bearer abc123");
        assert_eq!(format!("{header:?}"), "Authorization: ••••");
        assert!(!format!("{:?}", vec![header]).contains("abc123"));
    }

    #[test]
    fn refuses_a_header_without_a_name_or_value() {
        for header_line in [
            "Authorization",
            ": value",
            "Bad Name: x",
            "X-Token:",
            "X: a\nb",
        ] {
            assert!(
                SetupRequestHeader::parse(header_line).is_err(),
                "{header_line}"
            );
        }
    }
}
