/// What decides whether a server start prints the banner.
#[derive(Debug, Clone, Copy)]
pub struct BannerConditions {
    pub is_stdout_terminal: bool,
    /// `--no-banner`, `SENDMOCK_NO_BANNER=1` or `banner = false` in `sendmock.toml`.
    pub is_turned_off: bool,
    /// `--ready-json`: stdout carries one JSON line that scripts read.
    pub prints_ready_json: bool,
    /// `--log-format json`: every line is a JSON object for a log collector.
    pub logs_as_json: bool,
}

/// Only people at a terminal see it, so pipes, files, services and parsers read today's output.
pub fn should_print_banner(banner_conditions: &BannerConditions) -> bool {
    banner_conditions.is_stdout_terminal
        && !banner_conditions.is_turned_off
        && !banner_conditions.prints_ready_json
        && !banner_conditions.logs_as_json
}

#[cfg(test)]
mod tests {
    use super::*;

    const AT_A_TERMINAL: BannerConditions = BannerConditions {
        is_stdout_terminal: true,
        is_turned_off: false,
        prints_ready_json: false,
        logs_as_json: false,
    };

    // AC: PL-23.1
    #[test]
    fn a_start_at_a_terminal_prints_the_banner() {
        assert!(should_print_banner(&AT_A_TERMINAL));
    }

    // AC: PL-23.4
    #[test]
    fn piped_output_ready_json_and_json_logs_print_nothing() {
        let piped = BannerConditions {
            is_stdout_terminal: false,
            ..AT_A_TERMINAL
        };
        let ready_json = BannerConditions {
            prints_ready_json: true,
            ..AT_A_TERMINAL
        };
        let json_logs = BannerConditions {
            logs_as_json: true,
            ..AT_A_TERMINAL
        };

        assert!(!should_print_banner(&piped));
        assert!(!should_print_banner(&ready_json));
        assert!(!should_print_banner(&json_logs));
    }

    // AC: PL-23.5
    #[test]
    fn turned_off_prints_nothing() {
        let turned_off = BannerConditions {
            is_turned_off: true,
            ..AT_A_TERMINAL
        };

        assert!(!should_print_banner(&turned_off));
    }
}
