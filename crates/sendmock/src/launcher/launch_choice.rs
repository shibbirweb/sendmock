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
    /// The services a start with no flags runs: SMTP and the provider APIs, on their defaults.
    pub fn defaults() -> Self {
        Self::from_services(
            LaunchService::ALL
                .into_iter()
                .filter(|service| service.is_always_on() || service.is_on_by_default())
                .map(|service| (service, service.default_address())),
        )
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

    /// Fills the address of each chosen service a flag or variable did not set, and turns off
    /// a service that is on by default but not chosen; flags and variables win.
    pub fn apply_to(&self, serve_arguments: &mut ServeArguments) {
        for service in LaunchService::ALL {
            if service.is_set_by_flag(serve_arguments) {
                continue;
            }
            match self.addresses.get(&service) {
                Some(address) => service.write_address(serve_arguments, *address),
                None => service.turn_off(serve_arguments),
            }
        }
    }

    /// The `sendmock serve` command that starts the same services, for scripts and CI.
    pub fn describe_command(&self) -> String {
        let flags: Vec<String> = self
            .addresses
            .iter()
            .map(|(service, address)| format!("{} {address}", service.flag()))
            .chain(
                LaunchService::ALL
                    .into_iter()
                    .filter(|service| service.is_on_by_default() && !self.is_ticked(*service))
                    .map(|service| format!("{} none", service.flag())),
            )
            .collect();
        format!("sendmock serve {}", flags.join(" "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ListenerSetting;

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
            "sendmock serve --smtp-addr 127.0.0.1:1025 --catcher-addr 127.0.0.1:8030 --provider-addr none"
        );
    }

    // AC: PL-24.1
    #[test]
    fn a_choice_without_the_provider_apis_turns_their_default_port_off() {
        let choice =
            LaunchChoice::from_services([(LaunchService::Catcher, address("127.0.0.1:8030"))]);
        let mut serve_arguments = ServeArguments::default();

        choice.apply_to(&mut serve_arguments);

        assert_eq!(serve_arguments.provider_addr, Some(ListenerSetting::Off));
    }

    // AC: PL-24.1
    #[test]
    fn the_defaults_start_smtp_and_the_provider_apis_and_none_from_a_flag_wins() {
        let mut serve_arguments = ServeArguments {
            provider_addr: Some(ListenerSetting::Off),
            ..ServeArguments::default()
        };

        LaunchChoice::defaults().apply_to(&mut serve_arguments);

        assert!(LaunchChoice::defaults().is_ticked(LaunchService::Provider));
        assert_eq!(serve_arguments.provider_addr, Some(ListenerSetting::Off));
        assert_eq!(
            LaunchChoice::defaults().describe_command(),
            "sendmock serve --smtp-addr 127.0.0.1:1025 --provider-addr 127.0.0.1:8026"
        );
    }
}
