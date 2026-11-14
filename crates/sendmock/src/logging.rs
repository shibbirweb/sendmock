use std::io::IsTerminal;

use crate::config::{LogFormat, LogLevel};

/// Logs go to stdout, where Docker and log collectors read them, or to stderr when stdout
/// carries the `--ready-json` line; colours only on a terminal.
pub fn initialise_logging(log_format: LogFormat, log_level: LogLevel, is_stdout_reserved: bool) {
    let subscriber_builder = tracing_subscriber::fmt().with_max_level(log_level.to_level_filter());
    if is_stdout_reserved {
        let subscriber_builder = subscriber_builder
            .with_writer(std::io::stderr)
            .with_ansi(std::io::stderr().is_terminal());
        match log_format {
            LogFormat::Human => subscriber_builder.init(),
            LogFormat::Json => subscriber_builder.json().init(),
        }
        return;
    }
    let subscriber_builder = subscriber_builder
        .with_writer(std::io::stdout)
        .with_ansi(std::io::stdout().is_terminal());
    match log_format {
        LogFormat::Human => subscriber_builder.init(),
        LogFormat::Json => subscriber_builder.json().init(),
    }
}
