use std::path::{Path, PathBuf};
use std::process::Command;

/// What a program printed and whether it succeeded.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CommandOutcome {
    pub is_success: bool,
    pub output_text: String,
}

/// Runs the system's own tools (`security`, `certutil`, `php`, `keytool`, ...), so trust
/// targets can be tested with a fake.
pub trait CommandRunner: Send + Sync {
    fn run(&self, program: &str, arguments: &[&str]) -> CommandOutcome;

    /// The program's path when it is on `PATH` or at `fallback_path`.
    fn find_program(&self, program: &str, fallback_paths: &[PathBuf]) -> Option<PathBuf>;
}

pub struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn run(&self, program: &str, arguments: &[&str]) -> CommandOutcome {
        match Command::new(program).args(arguments).output() {
            Ok(output) => CommandOutcome {
                is_success: output.status.success(),
                output_text: format!(
                    "{}{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                ),
            },
            Err(run_error) => CommandOutcome {
                is_success: false,
                output_text: run_error.to_string(),
            },
        }
    }

    fn find_program(&self, program: &str, fallback_paths: &[PathBuf]) -> Option<PathBuf> {
        let path_variable = std::env::var_os("PATH").unwrap_or_default();
        let executable_names = if cfg!(windows) {
            vec![
                format!("{program}.exe"),
                format!("{program}.bat"),
                program.to_owned(),
            ]
        } else {
            vec![program.to_owned()]
        };
        std::env::split_paths(&path_variable)
            .flat_map(|folder| executable_names.iter().map(move |name| folder.join(name)))
            .chain(fallback_paths.iter().cloned())
            .find(|candidate| is_file(candidate))
    }
}

fn is_file(candidate: &Path) -> bool {
    candidate.is_file()
}
