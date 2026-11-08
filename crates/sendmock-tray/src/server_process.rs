use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

/// A SendMock server the tray starts and stops; tests use a fake.
pub trait ServerProcess {
    fn start(&mut self) -> Result<(), String>;
    fn stop(&mut self);
    /// Whether a started server has exited on its own since.
    fn has_exited(&mut self) -> bool;
}

/// `sendmock serve` as a child process.
pub struct ChildServerProcess {
    sendmock_binary: PathBuf,
    http_address: Option<String>,
    child: Option<Child>,
}

impl ChildServerProcess {
    pub fn new(sendmock_binary: PathBuf, http_address: Option<String>) -> Self {
        Self {
            sendmock_binary,
            http_address,
            child: None,
        }
    }
}

impl ServerProcess for ChildServerProcess {
    fn start(&mut self) -> Result<(), String> {
        let mut serve_command = Command::new(&self.sendmock_binary);
        serve_command.arg("serve");
        if let Some(http_address) = &self.http_address {
            serve_command.args(["--http-addr", http_address]);
        }
        let child = serve_command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|spawn_error| {
                format!(
                    "could not start {}: {spawn_error}",
                    self.sendmock_binary.display()
                )
            })?;
        self.child = Some(child);
        Ok(())
    }

    fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    fn has_exited(&mut self) -> bool {
        let has_exited = self
            .child
            .as_mut()
            .is_some_and(|child| matches!(child.try_wait(), Ok(Some(_))));
        if has_exited {
            self.child = None;
        }
        has_exited
    }
}

/// The `sendmock` binary's file name on this OS.
fn sendmock_file_name() -> &'static str {
    if cfg!(windows) {
        "sendmock.exe"
    } else {
        "sendmock"
    }
}

/// The `sendmock` to start: the one given, else the one beside the tray app, else the one on
/// `PATH` (by name, which the OS resolves).
pub fn find_sendmock_binary(given_binary: Option<&Path>, tray_binary: Option<&Path>) -> PathBuf {
    if let Some(given_binary) = given_binary {
        return given_binary.to_path_buf();
    }
    tray_binary
        .and_then(Path::parent)
        .map(|tray_folder| tray_folder.join(sendmock_file_name()))
        .filter(|beside_tray| beside_tray.is_file())
        .unwrap_or_else(|| PathBuf::from(sendmock_file_name()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_given_binary_wins_then_the_one_beside_the_tray_then_path() -> std::io::Result<()> {
        let tray_folder = tempfile_folder()?;
        let beside_tray = tray_folder.join(sendmock_file_name());
        std::fs::write(&beside_tray, b"")?;
        let tray_binary = tray_folder.join("sendmock-tray");

        assert_eq!(
            find_sendmock_binary(Some(Path::new("/opt/sendmock")), Some(&tray_binary)),
            PathBuf::from("/opt/sendmock")
        );
        assert_eq!(find_sendmock_binary(None, Some(&tray_binary)), beside_tray);
        assert_eq!(
            find_sendmock_binary(None, Some(Path::new("/nowhere/sendmock-tray"))),
            PathBuf::from(sendmock_file_name())
        );
        std::fs::remove_dir_all(tray_folder)
    }

    #[test]
    fn a_binary_that_cannot_start_is_reported() {
        let mut server_process = ChildServerProcess::new(PathBuf::from("/nowhere/sendmock"), None);

        assert!(server_process.start().is_err());
        assert!(!server_process.has_exited());
    }

    fn tempfile_folder() -> std::io::Result<PathBuf> {
        let folder =
            std::env::temp_dir().join(format!("sendmock-tray-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder)?;
        Ok(folder)
    }
}
