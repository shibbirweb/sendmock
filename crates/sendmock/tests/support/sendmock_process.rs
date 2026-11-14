use std::io::{self, BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Output, Stdio};
use std::sync::Mutex;
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

pub struct ReadyAddresses {
    pub http_addr: String,
    pub smtp_addr: String,
}

/// A running server whose stdout lines can be awaited.
pub struct SendmockProcess {
    child: Child,
    stdout_lines: Receiver<String>,
    /// Lines already taken from `stdout_lines`, kept so a test can read the whole output.
    read_lines: Mutex<Vec<String>>,
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
            read_lines: Mutex::new(Vec::new()),
        })
    }

    /// The HTTP address the server bound, read from its JSON ready line (`--log-format json`).
    pub fn wait_for_http_addr(&self) -> String {
        self.wait_for_ready_addresses().http_addr
    }

    /// The addresses the server bound, read from its JSON ready line, which comes once.
    pub fn wait_for_ready_addresses(&self) -> ReadyAddresses {
        let ready_line: serde_json::Value =
            serde_json::from_str(&self.wait_for_line(READY_MESSAGE)).unwrap_or_default();
        let read_address = |field_name: &str| {
            ready_line["fields"][field_name]
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| panic!("the ready line has no {field_name}: {ready_line}"))
        };
        ReadyAddresses {
            http_addr: read_address("http_addr"),
            smtp_addr: read_address("smtp_addr"),
        }
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
                Ok(line) => {
                    self.keep_read_line(line.clone());
                    if line.contains(expected_text) {
                        return line;
                    }
                }
                Err(_) => break,
            }
        }
        panic!("sendmock never printed a line with {expected_text:?}");
    }

    /// Everything the server printed so far, waiting until it has been quiet for `quiet_period`.
    pub fn read_printed_lines(&self, quiet_period: Duration) -> Vec<String> {
        while let Ok(line) = self.stdout_lines.recv_timeout(quiet_period) {
            self.keep_read_line(line);
        }
        self.read_lines
            .lock()
            .map(|read_lines| read_lines.clone())
            .unwrap_or_default()
    }

    fn keep_read_line(&self, line: String) {
        if let Ok(mut read_lines) = self.read_lines.lock() {
            read_lines.push(line);
        }
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
