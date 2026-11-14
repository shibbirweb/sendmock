use std::process::Command;

/// The command that opens a URL in the default browser on this OS.
pub fn build_open_command(url: &str) -> Command {
    if cfg!(target_os = "macos") {
        let mut open_command = Command::new("open");
        open_command.arg(url);
        open_command
    } else if cfg!(windows) {
        // `start` is built into cmd; its first quoted argument is a window title.
        let mut open_command = Command::new("cmd");
        open_command.args(["/C", "start", "", url]);
        open_command
    } else {
        let mut open_command = Command::new("xdg-open");
        open_command.arg(url);
        open_command
    }
}

/// Opens the web UI; an error says what could not be started.
pub fn open_in_browser(url: &str) -> Result<(), String> {
    build_open_command(url)
        .spawn()
        .map(|_| ())
        .map_err(|spawn_error| format!("could not open {url}: {spawn_error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: DS-08.2
    #[test]
    fn the_open_command_passes_the_url_to_the_os_opener() {
        let open_command = build_open_command("http://127.0.0.1:8025");
        let arguments: Vec<String> = open_command
            .get_args()
            .map(|argument| argument.to_string_lossy().into_owned())
            .collect();

        assert_eq!(
            arguments.last().map(String::as_str),
            Some("http://127.0.0.1:8025")
        );
    }
}
