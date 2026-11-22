//! The launcher's questions: which services, then Run, Change ports, Reset to defaults or
//! Cancel, with Run selected so a returning user presses Enter twice.

use std::collections::BTreeMap;
use std::io;
use std::net::SocketAddr;

use super::launch_choice::LaunchChoice;
use super::launch_service::LaunchService;
use super::port_check::find_next_free_address;

/// One line of the service list.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ServiceOffer {
    pub service: LaunchService,
    pub address: SocketAddr,
    pub is_ticked: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NextStep {
    Run,
    ChangePorts,
    ResetToDefaults,
    Cancel,
}

/// Asks the questions; the terminal one uses `dialoguer`, tests answer from a script.
pub trait LauncherPrompter {
    fn choose_services(
        &mut self,
        service_offers: &[ServiceOffer],
    ) -> io::Result<Vec<LaunchService>>;
    fn choose_next_step(&mut self, launch_choice: &LaunchChoice) -> io::Result<NextStep>;
    fn ask_address(&mut self, service: LaunchService, suggested: SocketAddr) -> io::Result<String>;
    fn tell(&mut self, message: &str);
}

/// Where the questions start, and what Reset to defaults goes back to.
pub struct LauncherStart {
    /// The last run's choice, or the first run's from the configuration.
    pub starting_choice: LaunchChoice,
    pub default_choice: LaunchChoice,
    /// The address offered for each service that is off.
    pub offered_addresses: BTreeMap<LaunchService, SocketAddr>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LauncherOutcome {
    Run {
        launch_choice: LaunchChoice,
        /// Reset to defaults was chosen, so the saved choice goes.
        was_reset: bool,
    },
    Cancel,
}

fn build_offers(
    launch_choice: &LaunchChoice,
    offered_addresses: &BTreeMap<LaunchService, SocketAddr>,
) -> Vec<ServiceOffer> {
    LaunchService::ALL
        .into_iter()
        .map(|service| ServiceOffer {
            service,
            address: launch_choice
                .addresses
                .get(&service)
                .or_else(|| offered_addresses.get(&service))
                .copied()
                .unwrap_or_else(|| service.default_address()),
            is_ticked: launch_choice.is_ticked(service),
        })
        .collect()
}

fn choose_services(
    prompter: &mut dyn LauncherPrompter,
    launch_choice: &LaunchChoice,
    offered_addresses: &BTreeMap<LaunchService, SocketAddr>,
) -> io::Result<LaunchChoice> {
    let service_offers = build_offers(launch_choice, offered_addresses);
    let ticked_services = prompter.choose_services(&service_offers)?;
    Ok(LaunchChoice::from_services(
        service_offers
            .into_iter()
            .filter(|offer| {
                offer.service.is_always_on() || ticked_services.contains(&offer.service)
            })
            .map(|offer| (offer.service, offer.address)),
    ))
}

/// Asks until the address parses, is not chosen twice and is free; a busy or repeated port is
/// named with the next free one offered.
fn ask_free_address(
    prompter: &mut dyn LauncherPrompter,
    service: LaunchService,
    current_address: SocketAddr,
    other_addresses: &[SocketAddr],
    is_free: &dyn Fn(SocketAddr) -> bool,
) -> io::Result<SocketAddr> {
    let mut suggested_address = current_address;
    loop {
        let answer = prompter.ask_address(service, suggested_address)?;
        let Ok(address) = answer.trim().parse::<SocketAddr>() else {
            prompter.tell("Use HOST:PORT, such as 127.0.0.1:8030.");
            continue;
        };
        let problem = if other_addresses.contains(&address) {
            Some(format!("Port {} is chosen twice.", address.port()))
        } else if address != current_address && !is_free(address) {
            Some(format!("Port {} is in use.", address.port()))
        } else {
            None
        };
        let Some(problem) = problem else {
            return Ok(address);
        };
        suggested_address =
            find_next_free_address(address, other_addresses, is_free).unwrap_or(current_address);
        prompter.tell(&format!("{problem} Try {suggested_address}."));
    }
}

fn change_ports(
    prompter: &mut dyn LauncherPrompter,
    launch_choice: &mut LaunchChoice,
    is_free: &dyn Fn(SocketAddr) -> bool,
) -> io::Result<()> {
    let services: Vec<LaunchService> = launch_choice.addresses.keys().copied().collect();
    for service in services {
        let current_address = launch_choice.addresses[&service];
        let other_addresses: Vec<SocketAddr> = launch_choice
            .addresses
            .iter()
            .filter(|(other_service, _)| **other_service != service)
            .map(|(_, other_address)| *other_address)
            .collect();
        let address = ask_free_address(
            prompter,
            service,
            current_address,
            &other_addresses,
            is_free,
        )?;
        launch_choice.addresses.insert(service, address);
    }
    Ok(())
}

/// Runs the questions until Run or Cancel.
pub fn run_launcher(
    prompter: &mut dyn LauncherPrompter,
    launcher_start: &LauncherStart,
    is_free: &dyn Fn(SocketAddr) -> bool,
) -> io::Result<LauncherOutcome> {
    let mut was_reset = false;
    let mut launch_choice = choose_services(
        prompter,
        &launcher_start.starting_choice,
        &launcher_start.offered_addresses,
    )?;
    loop {
        match prompter.choose_next_step(&launch_choice)? {
            NextStep::Run => {
                return Ok(LauncherOutcome::Run {
                    launch_choice,
                    was_reset,
                });
            }
            NextStep::ChangePorts => change_ports(prompter, &mut launch_choice, is_free)?,
            NextStep::ResetToDefaults => {
                was_reset = true;
                launch_choice =
                    choose_services(prompter, &launcher_start.default_choice, &BTreeMap::new())?;
            }
            NextStep::Cancel => return Ok(LauncherOutcome::Cancel),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;

    use super::*;

    /// Answers from a script and keeps what it was shown and told.
    #[derive(Default)]
    struct ScriptedPrompter {
        service_answers: VecDeque<Option<Vec<LaunchService>>>,
        step_answers: VecDeque<NextStep>,
        address_answers: VecDeque<&'static str>,
        shown_offers: Vec<Vec<ServiceOffer>>,
        suggested_addresses: Vec<SocketAddr>,
        told_messages: Vec<String>,
    }

    impl LauncherPrompter for ScriptedPrompter {
        /// `None` keeps the ticks as offered, as pressing Enter does.
        fn choose_services(
            &mut self,
            service_offers: &[ServiceOffer],
        ) -> io::Result<Vec<LaunchService>> {
            self.shown_offers.push(service_offers.to_vec());
            let as_offered = service_offers
                .iter()
                .filter(|offer| offer.is_ticked)
                .map(|offer| offer.service)
                .collect();
            Ok(self
                .service_answers
                .pop_front()
                .flatten()
                .unwrap_or(as_offered))
        }

        fn choose_next_step(&mut self, _launch_choice: &LaunchChoice) -> io::Result<NextStep> {
            Ok(self.step_answers.pop_front().unwrap_or(NextStep::Cancel))
        }

        fn ask_address(
            &mut self,
            _service: LaunchService,
            suggested: SocketAddr,
        ) -> io::Result<String> {
            self.suggested_addresses.push(suggested);
            Ok(self
                .address_answers
                .pop_front()
                .unwrap_or_default()
                .to_owned())
        }

        fn tell(&mut self, message: &str) {
            self.told_messages.push(message.to_owned());
        }
    }

    fn address(port: u16) -> SocketAddr {
        SocketAddr::from(([127, 0, 0, 1], port))
    }

    fn returning_start() -> LauncherStart {
        LauncherStart {
            starting_choice: LaunchChoice::from_services([(LaunchService::Catcher, address(8030))]),
            default_choice: LaunchChoice::defaults(),
            offered_addresses: BTreeMap::from([(LaunchService::Pop3, address(2110))]),
        }
    }

    // AC: PL-22.2
    // AC: PL-22.3
    #[test]
    fn a_returning_user_starts_the_last_choice_with_two_presses_of_enter() -> io::Result<()> {
        let mut prompter = ScriptedPrompter {
            step_answers: VecDeque::from([NextStep::Run]),
            ..ScriptedPrompter::default()
        };

        let outcome = run_launcher(&mut prompter, &returning_start(), &|_| true)?;

        let LauncherOutcome::Run {
            launch_choice,
            was_reset,
        } = outcome
        else {
            panic!("expected Run");
        };
        assert!(!was_reset);
        assert_eq!(
            launch_choice.addresses.get(&LaunchService::Catcher),
            Some(&address(8030))
        );
        let shown = &prompter.shown_offers[0];
        assert_eq!(shown.len(), LaunchService::ALL.len());
        let pop3_offer = shown
            .iter()
            .find(|offer| offer.service == LaunchService::Pop3);
        assert_eq!(
            pop3_offer.map(|offer| (offer.address, offer.is_ticked)),
            Some((address(2110), false))
        );
        Ok(())
    }

    // AC: PL-22.3
    #[test]
    fn change_ports_names_a_repeated_or_busy_port_and_offers_the_next_free_one() -> io::Result<()> {
        let mut prompter = ScriptedPrompter {
            step_answers: VecDeque::from([NextStep::ChangePorts, NextStep::Run]),
            address_answers: VecDeque::from([
                "127.0.0.1:1025",
                "127.0.0.1:1025",
                "127.0.0.1:9999",
                "not an address",
                "127.0.0.1:9100",
            ]),
            ..ScriptedPrompter::default()
        };

        let outcome = run_launcher(&mut prompter, &returning_start(), &|candidate| {
            candidate.port() != 9999
        })?;

        let LauncherOutcome::Run { launch_choice, .. } = outcome else {
            panic!("expected Run");
        };
        assert_eq!(
            launch_choice.addresses.get(&LaunchService::Catcher),
            Some(&address(9100))
        );
        assert_eq!(
            prompter.told_messages,
            vec![
                "Port 1025 is chosen twice. Try 127.0.0.1:1026.".to_owned(),
                "Port 9999 is in use. Try 127.0.0.1:10000.".to_owned(),
                "Use HOST:PORT, such as 127.0.0.1:8030.".to_owned(),
            ]
        );
        Ok(())
    }

    // AC: PL-22.3
    #[test]
    fn reset_to_defaults_goes_back_to_smtp_alone_and_cancel_starts_nothing() -> io::Result<()> {
        let mut reset_prompter = ScriptedPrompter {
            step_answers: VecDeque::from([NextStep::ResetToDefaults, NextStep::Run]),
            ..ScriptedPrompter::default()
        };
        let mut cancel_prompter = ScriptedPrompter {
            step_answers: VecDeque::from([NextStep::Cancel]),
            ..ScriptedPrompter::default()
        };

        let reset_outcome = run_launcher(&mut reset_prompter, &returning_start(), &|_| true)?;
        let cancel_outcome = run_launcher(&mut cancel_prompter, &returning_start(), &|_| true)?;

        assert_eq!(
            reset_outcome,
            LauncherOutcome::Run {
                launch_choice: LaunchChoice::defaults(),
                was_reset: true
            }
        );
        assert_eq!(cancel_outcome, LauncherOutcome::Cancel);
        Ok(())
    }
}
