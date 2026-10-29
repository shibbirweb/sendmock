use std::io::{self, BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Output, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::{Duration, Instant};

pub const READY_MESSAGE: &str = "SendMock is ready";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);

/// A `sendmock` command that inherits no `SENDMOCK_*` variable from the machine running the
/// tests, with SMTP on a free port so servers started in parallel never collide.
pub fn sendmock_command(working_directory: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_sendmock"));
    command.current_dir(working_directory);
    for (variable_name, _) in std::env::vars() {
        if variable_name.starts_with("SENDMOCK_") {
            command.env_remove(variable_name);
        }
    }
    command.env("SENDMOCK_SMTP_ADDR", "127.0.0.1:0");
    command
}

pub fn run_until_exit(command: &mut Command) -> io::Result<Output> {
    command.stdin(Stdio::null()).output()
}

/// A running server whose stdout lines can be awaited.
pub struct SendmockProcess {
    child: Child,
    stdout_lines: Receiver<String>,
}

impl SendmockProcess {
    /// A server on a free port with an in-memory database and JSON logs.
    pub fn start_with_free_port(working_directory: &Path) -> io::Result<Self> {
        Self::start(sendmock_command(working_directory).args([
            "--http-addr",
            "127.0.0.1:0",
            "--db",
            "memory",
            "--log-format",
            "json",
        ]))
    }

    pub fn start(command: &mut Command) -> io::Result<Self> {
        let mut child = command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| io::Error::other("stdout is not piped"))?;
        let (line_sender, stdout_lines) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if line_sender.send(line).is_err() {
                    break;
                }
            }
        });
        Ok(Self {
            child,
            stdout_lines,
        })
    }

    /// The address the server bound, read from its JSON ready line (`--log-format json`).
    pub fn wait_for_http_addr(&self) -> String {
        let ready_line: serde_json::Value =
            serde_json::from_str(&self.wait_for_line(READY_MESSAGE)).unwrap_or_default();
        ready_line["fields"]["http_addr"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| panic!("the ready line has no http_addr: {ready_line}"))
    }

    /// The SMTP address the server bound, read from its JSON ready line.
    pub fn wait_for_smtp_addr(&self) -> String {
        let ready_line: serde_json::Value =
            serde_json::from_str(&self.wait_for_line(READY_MESSAGE)).unwrap_or_default();
        ready_line["fields"]["smtp_addr"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| panic!("the ready line has no smtp_addr: {ready_line}"))
    }

    #[cfg(unix)]
    pub fn process_id(&self) -> u32 {
        self.child.id()
    }

    /// The first stdout line containing `expected_text`, or a panic after the startup timeout.
    pub fn wait_for_line(&self, expected_text: &str) -> String {
        let deadline = Instant::now() + STARTUP_TIMEOUT;
        while let Some(time_left) = deadline.checked_duration_since(Instant::now()) {
            match self.stdout_lines.recv_timeout(time_left) {
                Ok(line) if line.contains(expected_text) => return line,
                Ok(_) => {}
                Err(_) => break,
            }
        }
        panic!("sendmock never printed a line with {expected_text:?}");
    }

    #[cfg(unix)]
    pub fn wait_for_exit_success(mut self) -> bool {
        self.child
            .wait()
            .map(|exit_status| exit_status.success())
            .unwrap_or(false)
    }
}

impl Drop for SendmockProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
