/// What decides whether a start may ask questions.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LaunchConditions {
    /// No command and no option: `sendmock` alone.
    pub is_bare_command: bool,
    pub is_stdin_terminal: bool,
    pub is_stdout_terminal: bool,
    /// `CI` is set, as CI services set it.
    pub is_ci: bool,
    /// `--no-input` or `SENDMOCK_NO_INPUT=1`.
    pub is_no_input: bool,
}

/// Asks only a person at a terminal who typed `sendmock` alone, as the Command Line Interface
/// Guidelines advise; scripts, pipes, services and CI run as before.
pub fn should_ask(launch_conditions: LaunchConditions) -> bool {
    launch_conditions.is_bare_command
        && launch_conditions.is_stdin_terminal
        && launch_conditions.is_stdout_terminal
        && !launch_conditions.is_ci
        && !launch_conditions.is_no_input
}

#[cfg(test)]
mod tests {
    use super::*;

    const AT_A_TERMINAL: LaunchConditions = LaunchConditions {
        is_bare_command: true,
        is_stdin_terminal: true,
        is_stdout_terminal: true,
        is_ci: false,
        is_no_input: false,
    };

    // AC: PL-22.1
    #[test]
    fn only_a_bare_sendmock_at_a_terminal_asks() {
        assert!(should_ask(AT_A_TERMINAL));
        for quiet_conditions in [
            LaunchConditions {
                is_bare_command: false,
                ..AT_A_TERMINAL
            },
            LaunchConditions {
                is_stdin_terminal: false,
                ..AT_A_TERMINAL
            },
            LaunchConditions {
                is_stdout_terminal: false,
                ..AT_A_TERMINAL
            },
            LaunchConditions {
                is_ci: true,
                ..AT_A_TERMINAL
            },
            LaunchConditions {
                is_no_input: true,
                ..AT_A_TERMINAL
            },
        ] {
            assert!(!should_ask(quiet_conditions), "{quiet_conditions:?}");
        }
    }
}
