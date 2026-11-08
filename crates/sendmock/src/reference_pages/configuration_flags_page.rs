use std::path::Path;

use clap::{Arg, ArgAction, Args, Command};

use super::markdown_table::{code, render_markdown_table};
use super::render_page_header;
use crate::cli_arguments::ServeArguments;
use crate::config::ConfigFile;

const DEFAULT_MARKER: &str = " [default: ";

pub fn render_configuration_flags_page() -> String {
    let serve_command = ServeArguments::augment_args(Command::new("serve"));
    let rows: Vec<Vec<String>> = serve_command
        .get_arguments()
        .filter(|argument| argument.get_long().is_some())
        .map(describe_flag)
        .collect();
    let mut page = render_page_header(
        "Configuration flags",
        "Every flag of sendmock serve, with its environment variable, sendmock.toml key and default.",
    );
    page.push_str(
        "Each setting can come from a flag, a `SENDMOCK_*` environment variable or a key in \
         `sendmock.toml`. A flag wins over the variable, and both win over the file; an unknown \
         key or an invalid value stops SendMock at startup with a message. See \
         [Configuration and seed file](../configuration.md) for how they fit together.\n\n",
    );
    page.push_str(&render_markdown_table(
        &[
            "Flag",
            "Environment variable",
            "`sendmock.toml` key",
            "Default",
            "What it does",
        ],
        &rows,
    ));
    page
}

fn describe_flag(argument: &Arg) -> Vec<String> {
    let long_name = argument.get_long().unwrap_or_default();
    let is_switch = matches!(
        argument.get_action(),
        ArgAction::SetTrue | ArgAction::SetFalse
    );
    let value_label = argument
        .get_value_names()
        .and_then(|value_names| value_names.first())
        .filter(|_| !is_switch)
        .map(|value_name| format!(" <{value_name}>"))
        .unwrap_or_default();
    let environment_variable = argument
        .get_env()
        .map(|variable_name| code(&variable_name.to_string_lossy()))
        .unwrap_or_default();
    let help_text = argument
        .get_help()
        .map(ToString::to_string)
        .unwrap_or_default();
    let (description, default_value) = split_default(&help_text);
    vec![
        code(&format!("--{long_name}{value_label}")),
        environment_variable,
        find_config_file_key(long_name).map_or_else(String::new, |key| code(&key)),
        format_default(&default_value),
        description,
    ]
}

/// A single value such as `127.0.0.1:1025` or `*` as code; a sentence stays text.
fn format_default(default_value: &str) -> String {
    if default_value.is_empty() || default_value.contains(' ') {
        default_value.to_owned()
    } else {
        code(default_value)
    }
}

/// "Address for the SMTP listener [default: 127.0.0.1:1025]" into its two parts.
fn split_default(help_text: &str) -> (String, String) {
    match help_text.find(DEFAULT_MARKER) {
        Some(marker_start) => {
            let default_value = help_text[marker_start + DEFAULT_MARKER.len()..]
                .trim_end_matches(']')
                .to_owned();
            (format!("{}.", &help_text[..marker_start]), default_value)
        }
        None => (format!("{help_text}."), String::new()),
    }
}

/// The `sendmock.toml` key for a flag, found by asking the config file parser, which refuses
/// unknown keys: `--provider-port` is the `provider_ports` table.
fn find_config_file_key(long_name: &str) -> Option<String> {
    let snake_case_name = long_name.replace('-', "_");
    [snake_case_name.clone(), format!("{snake_case_name}s")]
        .into_iter()
        .find(|candidate_key| {
            let parse_result = ConfigFile::parse(
                &format!("{candidate_key} = 0"),
                Path::new("sendmock.toml"),
            );
            !matches!(parse_result, Err(config_error) if config_error.to_string().contains("unknown field"))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_flag_with_a_file_key_finds_it_and_one_without_finds_none() {
        assert_eq!(
            find_config_file_key("smtp-addr").as_deref(),
            Some("smtp_addr")
        );
        assert_eq!(
            find_config_file_key("provider-port").as_deref(),
            Some("provider_ports")
        );
        assert_eq!(find_config_file_key("config"), None);
    }

    #[test]
    fn the_default_is_read_from_the_help_text() {
        assert_eq!(
            split_default("Address for the SMTP listener [default: 127.0.0.1:1025]"),
            (
                "Address for the SMTP listener.".to_owned(),
                "127.0.0.1:1025".to_owned()
            )
        );
        assert_eq!(
            split_default("Offer STARTTLS on the SMTP port"),
            ("Offer STARTTLS on the SMTP port.".to_owned(), String::new())
        );
    }
}
