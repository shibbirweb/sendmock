//! The startup banner (PL-23): a server command started in a terminal first prints the
//! website footer's SendMock wordmark in braille dots, sized to the terminal, with the version
//! under it, so people see what started; pipes, files and machine-readable output never get it.

mod banner_colors;
mod banner_conditions;
mod banner_size;
mod banner_text;
mod braille_raster;
mod terminal_environment;
mod wordmark_outline;

use std::io::{IsTerminal, Write};

use dialoguer::console::Term;

use banner_conditions::{BannerConditions, should_print_banner};
use banner_size::choose_banner_line_count;
use banner_text::{BannerLayout, render_banner};
use terminal_environment::{TerminalEnvironment, can_show_braille, choose_color_level};

use crate::cli_arguments::ServeArguments;
use crate::config::{LogFormat, ServerConfig};

/// Prints the banner when this start should have one; a configuration error prints nothing,
/// since the start that follows reports it.
pub fn print_startup_banner(serve_arguments: &ServeArguments) {
    let Ok(server_config) = ServerConfig::load(serve_arguments) else {
        return;
    };
    let stdout = std::io::stdout();
    let banner_conditions = BannerConditions {
        is_stdout_terminal: stdout.is_terminal(),
        is_turned_off: !server_config.shows_banner,
        prints_ready_json: server_config.prints_ready_json,
        logs_as_json: server_config.log_format == LogFormat::Json,
    };
    if !should_print_banner(&banner_conditions) {
        return;
    }
    let terminal_environment = TerminalEnvironment::read();
    let terminal_columns = Term::stdout()
        .size_checked()
        .map(|(_, column_count)| usize::from(column_count));
    let banner_layout =
        choose_banner_layout(terminal_columns, can_show_braille(&terminal_environment));
    let banner = render_banner(
        env!("CARGO_PKG_VERSION"),
        banner_layout,
        choose_color_level(&terminal_environment),
    );
    let mut stdout_lock = stdout.lock();
    let _ = stdout_lock.write_all(banner.as_bytes());
    let _ = stdout_lock.flush();
}

/// The wordmark when the terminal is wide enough and shows braille, otherwise one plain line.
fn choose_banner_layout(terminal_columns: Option<usize>, can_show_braille: bool) -> BannerLayout {
    if !can_show_braille {
        return BannerLayout::OneLine;
    }
    match terminal_columns.and_then(choose_banner_line_count) {
        Some(line_count) => BannerLayout::Wordmark { line_count },
        None => BannerLayout::OneLine,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-23.2
    #[test]
    fn an_eighty_column_terminal_gets_the_eight_line_wordmark() {
        assert_eq!(
            choose_banner_layout(Some(80), true),
            BannerLayout::Wordmark { line_count: 8 }
        );
    }

    // AC: PL-23.2
    #[test]
    fn a_narrow_terminal_an_unknown_width_or_no_braille_gets_one_line() {
        assert_eq!(choose_banner_layout(Some(40), true), BannerLayout::OneLine);
        assert_eq!(choose_banner_layout(None, true), BannerLayout::OneLine);
        assert_eq!(
            choose_banner_layout(Some(200), false),
            BannerLayout::OneLine
        );
    }
}
