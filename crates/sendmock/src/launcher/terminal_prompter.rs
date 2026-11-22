use std::io;
use std::net::SocketAddr;

use dialoguer::theme::SimpleTheme;
use dialoguer::{Input, MultiSelect, Select};

use super::launch_choice::LaunchChoice;
use super::launch_service::LaunchService;
use super::launcher_flow::{LauncherPrompter, NextStep, ServiceOffer};

const NEXT_STEPS: [(&str, NextStep); 4] = [
    ("Run", NextStep::Run),
    ("Change ports", NextStep::ChangePorts),
    ("Reset to defaults", NextStep::ResetToDefaults),
    ("Cancel", NextStep::Cancel),
];

/// The questions at a terminal: arrows, Space and Enter, readable without colour.
pub struct TerminalPrompter {
    /// Shown above the list, as the HTTP port is always on.
    pub http_address: SocketAddr,
}

fn to_io_error(prompt_error: dialoguer::Error) -> io::Error {
    match prompt_error {
        dialoguer::Error::IO(io_error) => io_error,
    }
}

impl LauncherPrompter for TerminalPrompter {
    fn choose_services(
        &mut self,
        service_offers: &[ServiceOffer],
    ) -> io::Result<Vec<LaunchService>> {
        let item_labels: Vec<String> = service_offers
            .iter()
            .map(|offer| {
                let always_on = if offer.service.is_always_on() {
                    " (always on)"
                } else {
                    ""
                };
                format!("{:<22} {}{always_on}", offer.service.label(), offer.address)
            })
            .collect();
        let ticks: Vec<bool> = service_offers.iter().map(|offer| offer.is_ticked).collect();
        let chosen_indexes = MultiSelect::with_theme(&SimpleTheme)
            .with_prompt(format!(
                "Web UI, REST API and MCP on http://{} (always on).\nServices to start (Space ticks, Enter confirms)",
                self.http_address
            ))
            .items(&item_labels)
            .defaults(&ticks)
            .interact()
            .map_err(to_io_error)?;
        Ok(chosen_indexes
            .into_iter()
            .filter_map(|chosen_index| service_offers.get(chosen_index))
            .map(|offer| offer.service)
            .collect())
    }

    fn choose_next_step(&mut self, launch_choice: &LaunchChoice) -> io::Result<NextStep> {
        println!("{}", launch_choice.describe_command());
        let step_labels: Vec<&str> = NEXT_STEPS.iter().map(|(label, _)| *label).collect();
        let chosen_index = Select::with_theme(&SimpleTheme)
            .with_prompt("Start")
            .items(&step_labels)
            .default(0)
            .interact()
            .map_err(to_io_error)?;
        Ok(NEXT_STEPS
            .get(chosen_index)
            .map_or(NextStep::Cancel, |(_, next_step)| *next_step))
    }

    fn ask_address(&mut self, service: LaunchService, suggested: SocketAddr) -> io::Result<String> {
        Input::<String>::with_theme(&SimpleTheme)
            .with_prompt(format!("{} address", service.label()))
            .with_initial_text(suggested.to_string())
            .interact_text()
            .map_err(to_io_error)
    }

    fn tell(&mut self, message: &str) {
        eprintln!("{message}");
    }
}
