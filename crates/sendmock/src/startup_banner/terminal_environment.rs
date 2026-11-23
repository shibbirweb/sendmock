/// The environment variables that say what the terminal can show.
#[derive(Debug, Clone, Default)]
pub struct TerminalEnvironment {
    pub colorterm: Option<String>,
    pub term: Option<String>,
    /// `NO_COLOR` set to anything but an empty string (no-color.org).
    pub has_no_color: bool,
    /// The first of `LC_ALL`, `LC_CTYPE` and `LANG` that is set, as the C library reads them.
    pub locale: Option<String>,
    pub is_windows: bool,
    /// `WT_SESSION`: Windows Terminal, whose fonts have braille.
    pub is_windows_terminal: bool,
    /// `TERM_PROGRAM`: set by VS Code, WezTerm and other terminals that bring their own fonts.
    pub term_program: Option<String>,
}

/// How many colours the banner may use.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorLevel {
    None,
    Ansi256,
    TrueColor,
}

fn read_non_empty_variable(variable_name: &str) -> Option<String> {
    std::env::var(variable_name)
        .ok()
        .filter(|variable_value| !variable_value.is_empty())
}

impl TerminalEnvironment {
    pub fn read() -> Self {
        Self {
            colorterm: read_non_empty_variable("COLORTERM"),
            term: read_non_empty_variable("TERM"),
            has_no_color: read_non_empty_variable("NO_COLOR").is_some(),
            locale: ["LC_ALL", "LC_CTYPE", "LANG"]
                .into_iter()
                .find_map(read_non_empty_variable),
            is_windows: cfg!(windows),
            is_windows_terminal: read_non_empty_variable("WT_SESSION").is_some(),
            term_program: read_non_empty_variable("TERM_PROGRAM"),
        }
    }
}

/// 24-bit colour only where the terminal says so, as colour libraries such as supports-color do.
pub fn choose_color_level(terminal_environment: &TerminalEnvironment) -> ColorLevel {
    if terminal_environment.has_no_color || terminal_environment.term.as_deref() == Some("dumb") {
        return ColorLevel::None;
    }
    match terminal_environment.colorterm.as_deref() {
        Some("truecolor" | "24bit") => ColorLevel::TrueColor,
        _ => ColorLevel::Ansi256,
    }
}

/// On Unix a UTF-8 locale. On Windows the console takes UTF-16 from Rust whatever its code
/// page, but the classic console's fonts have no braille, so only terminals with their own fonts.
pub fn can_show_braille(terminal_environment: &TerminalEnvironment) -> bool {
    if terminal_environment.term.as_deref() == Some("dumb") {
        return false;
    }
    if terminal_environment.is_windows {
        return terminal_environment.is_windows_terminal
            || terminal_environment.term_program.is_some();
    }
    terminal_environment
        .locale
        .as_deref()
        .is_some_and(|locale| {
            let lowercase_locale = locale.to_ascii_lowercase();
            lowercase_locale.contains("utf-8") || lowercase_locale.contains("utf8")
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unix_terminal(locale: &str) -> TerminalEnvironment {
        TerminalEnvironment {
            locale: Some(locale.to_owned()),
            term: Some("xterm-256color".to_owned()),
            ..TerminalEnvironment::default()
        }
    }

    // AC: PL-23.3
    #[test]
    fn colorterm_truecolor_or_24bit_gets_24_bit_colour_and_anything_else_256() {
        let mut terminal_environment = unix_terminal("en_US.UTF-8");
        assert_eq!(
            choose_color_level(&terminal_environment),
            ColorLevel::Ansi256
        );

        terminal_environment.colorterm = Some("truecolor".to_owned());
        assert_eq!(
            choose_color_level(&terminal_environment),
            ColorLevel::TrueColor
        );

        terminal_environment.colorterm = Some("24bit".to_owned());
        assert_eq!(
            choose_color_level(&terminal_environment),
            ColorLevel::TrueColor
        );
    }

    // AC: PL-23.3
    #[test]
    fn no_color_or_a_dumb_terminal_gets_no_colour() {
        let mut no_color = unix_terminal("en_US.UTF-8");
        no_color.colorterm = Some("truecolor".to_owned());
        no_color.has_no_color = true;
        let mut dumb = unix_terminal("en_US.UTF-8");
        dumb.term = Some("dumb".to_owned());

        assert_eq!(choose_color_level(&no_color), ColorLevel::None);
        assert_eq!(choose_color_level(&dumb), ColorLevel::None);
    }

    // AC: PL-23.2
    #[test]
    fn unix_shows_braille_only_with_a_utf8_locale() {
        assert!(can_show_braille(&unix_terminal("en_US.UTF-8")));
        assert!(can_show_braille(&unix_terminal("C.utf8")));
        assert!(!can_show_braille(&unix_terminal("C")));
        assert!(!can_show_braille(&TerminalEnvironment::default()));
    }

    // AC: PL-23.2
    #[test]
    fn windows_shows_braille_only_in_terminals_with_their_own_fonts() {
        let classic_console = TerminalEnvironment {
            is_windows: true,
            ..TerminalEnvironment::default()
        };
        let windows_terminal = TerminalEnvironment {
            is_windows_terminal: true,
            ..classic_console.clone()
        };
        let vs_code = TerminalEnvironment {
            term_program: Some("vscode".to_owned()),
            ..classic_console.clone()
        };

        assert!(!can_show_braille(&classic_console));
        assert!(can_show_braille(&windows_terminal));
        assert!(can_show_braille(&vs_code));
    }
}
