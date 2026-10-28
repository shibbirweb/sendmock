use std::io::IsTerminal;

use crate::config::{LogFormat, LogLevel};

/// Logs go to stdout, where Docker and log collectors read them; colours only on a terminal.
pub fn initialise_logging(log_format: LogFormat, log_level: LogLevel) {
    let subscriber_builder = tracing_subscriber::fmt()
        .with_max_level(log_level.to_level_filter())
        .with_writer(std::io::stdout)
        .with_ansi(std::io::stdout().is_terminal());
    match log_format {
        LogFormat::Human => subscriber_builder.init(),
        LogFormat::Json => subscriber_builder.json().init(),
    }
}
