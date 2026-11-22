use std::collections::BTreeMap;
use std::net::SocketAddr;

use super::launch_service::LaunchService;
use crate::cli_arguments::ServeArguments;

/// The services to start and their addresses; SMTP is always among them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchChoice {
    pub addresses: BTreeMap<LaunchService, SocketAddr>,
}

impl LaunchChoice {
    /// SMTP alone, on its default address: today's start.
    pub fn defaults() -> Self {
        Self::from_services([(LaunchService::Smtp, LaunchService::Smtp.default_address())])
    }

    pub fn from_services(services: impl IntoIterator<Item = (LaunchService, SocketAddr)>) -> Self {
        let mut addresses: BTreeMap<LaunchService, SocketAddr> = services.into_iter().collect();
        addresses
            .entry(LaunchService::Smtp)
            .or_insert_with(|| LaunchService::Smtp.default_address());
        Self { addresses }
    }

    pub fn is_ticked(&self, service: LaunchService) -> bool {
        self.addresses.contains_key(&service)
    }

    /// Fills the address of each chosen service a flag or variable did not set; those win.
    pub fn apply_to(&self, serve_arguments: &mut ServeArguments) {
        for (service, address) in &self.addresses {
            if service.read_address(serve_arguments).is_none() {
                service.write_address(serve_arguments, *address);
            }
        }
    }

    /// The `sendmock serve` command that starts the same services, for scripts and CI.
    pub fn describe_command(&self) -> String {
        let flags: Vec<String> = self
            .addresses
            .iter()
            .map(|(service, address)| format!("{} {address}", service.flag()))
            .collect();
        format!("sendmock serve {}", flags.join(" "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn address(text: &str) -> SocketAddr {
        text.parse()
            .unwrap_or_else(|_| LaunchService::Smtp.default_address())
    }

    // AC: PL-22.5
    #[test]
    fn flags_win_over_the_saved_choice_for_that_run() {
        let saved_choice = LaunchChoice::from_services([
            (LaunchService::Catcher, address("127.0.0.1:8030")),
            (LaunchService::Pop3, address("127.0.0.1:1110")),
        ]);
        let mut serve_arguments = ServeArguments {
            catcher_addr: Some(address("127.0.0.1:9030")),
            ..ServeArguments::default()
        };

        saved_choice.apply_to(&mut serve_arguments);

        assert_eq!(
            serve_arguments.catcher_addr,
            Some(address("127.0.0.1:9030"))
        );
        assert_eq!(serve_arguments.pop3_addr, Some(address("127.0.0.1:1110")));
        assert_eq!(serve_arguments.smtp_addr, Some(address("127.0.0.1:1025")));
    }

    // AC: PL-22.4
    #[test]
    fn the_equivalent_command_names_every_chosen_listener() {
        let choice =
            LaunchChoice::from_services([(LaunchService::Catcher, address("127.0.0.1:8030"))]);

        assert_eq!(
            choice.describe_command(),
            "sendmock serve --smtp-addr 127.0.0.1:1025 --catcher-addr 127.0.0.1:8030"
        );
    }
}
