use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use crate::cli_arguments::ServeArguments;
use crate::config::DEFAULT_SMTP_ADDR;

/// A listener the launcher offers next to the HTTP port, which is always on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LaunchService {
    Smtp,
    Smtps,
    Provider,
    ProviderTls,
    Catcher,
    Pop3,
}

const fn local_address(port: u16) -> SocketAddr {
    SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port)
}

impl LaunchService {
    pub const ALL: [Self; 6] = [
        Self::Smtp,
        Self::Smtps,
        Self::Provider,
        Self::ProviderTls,
        Self::Catcher,
        Self::Pop3,
    ];

    /// The name `--services` and `last-run.toml` use.
    pub fn name(self) -> &'static str {
        match self {
            Self::Smtp => "smtp",
            Self::Smtps => "smtps",
            Self::Provider => "provider",
            Self::ProviderTls => "provider-tls",
            Self::Catcher => "catcher",
            Self::Pop3 => "pop3",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Smtp => "SMTP",
            Self::Smtps => "SMTPS",
            Self::Provider => "Provider APIs (HTTP)",
            Self::ProviderTls => "Provider APIs (HTTPS)",
            Self::Catcher => "HTTP Catcher",
            Self::Pop3 => "POP3",
        }
    }

    /// The flag that sets its address, for the equivalent `sendmock serve` command.
    pub fn flag(self) -> &'static str {
        match self {
            Self::Smtp => "--smtp-addr",
            Self::Smtps => "--smtps-addr",
            Self::Provider => "--provider-addr",
            Self::ProviderTls => "--provider-tls-addr",
            Self::Catcher => "--catcher-addr",
            Self::Pop3 => "--pop3-addr",
        }
    }

    /// SMTP always runs; SendMock has no way to start without it.
    pub fn is_always_on(self) -> bool {
        self == Self::Smtp
    }

    /// The address offered when nothing configures one: the ports the guide uses.
    pub fn default_address(self) -> SocketAddr {
        match self {
            Self::Smtp => DEFAULT_SMTP_ADDR,
            Self::Smtps => local_address(1465),
            Self::Provider => local_address(8026),
            Self::ProviderTls => local_address(8027),
            Self::Catcher => local_address(8030),
            Self::Pop3 => local_address(1110),
        }
    }

    pub fn parse(service_name: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|service| service.name() == service_name.trim())
    }

    /// The address a flag or `SENDMOCK_*` variable gave it.
    pub fn read_address(self, serve_arguments: &ServeArguments) -> Option<SocketAddr> {
        match self {
            Self::Smtp => serve_arguments.smtp_addr,
            Self::Smtps => serve_arguments.smtps_addr,
            Self::Provider => serve_arguments.provider_addr,
            Self::ProviderTls => serve_arguments.provider_tls_addr,
            Self::Catcher => serve_arguments.catcher_addr,
            Self::Pop3 => serve_arguments.pop3_addr,
        }
    }

    pub fn write_address(self, serve_arguments: &mut ServeArguments, address: SocketAddr) {
        let address_field = match self {
            Self::Smtp => &mut serve_arguments.smtp_addr,
            Self::Smtps => &mut serve_arguments.smtps_addr,
            Self::Provider => &mut serve_arguments.provider_addr,
            Self::ProviderTls => &mut serve_arguments.provider_tls_addr,
            Self::Catcher => &mut serve_arguments.catcher_addr,
            Self::Pop3 => &mut serve_arguments.pop3_addr,
        };
        *address_field = Some(address);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_service_reads_back_from_its_name_and_writes_its_own_flag() {
        let mut serve_arguments = ServeArguments::default();
        for service in LaunchService::ALL {
            assert_eq!(LaunchService::parse(service.name()), Some(service));
            service.write_address(&mut serve_arguments, service.default_address());
            assert_eq!(
                service.read_address(&serve_arguments),
                Some(service.default_address())
            );
        }
        assert_eq!(LaunchService::parse("ftp"), None);
    }
}
