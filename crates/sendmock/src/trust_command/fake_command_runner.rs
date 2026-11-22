use std::path::PathBuf;
use std::sync::Mutex;

use super::command_runner::{CommandOutcome, CommandRunner};

/// Answers each program with a fixed outcome and records every call.
#[derive(Default)]
pub struct FakeCommandRunner {
    pub succeeding_programs: Vec<String>,
    pub calls: Mutex<Vec<String>>,
}

impl FakeCommandRunner {
    pub fn succeeding(programs: &[&str]) -> Self {
        Self {
            succeeding_programs: programs
                .iter()
                .map(|program| (*program).to_owned())
                .collect(),
            calls: Mutex::new(Vec::new()),
        }
    }

    pub fn recorded_calls(&self) -> Vec<String> {
        self.calls
            .lock()
            .map(|calls| calls.clone())
            .unwrap_or_default()
    }
}

impl CommandRunner for FakeCommandRunner {
    fn run(&self, program: &str, arguments: &[&str]) -> CommandOutcome {
        if let Ok(mut calls) = self.calls.lock() {
            calls.push(format!("{program} {}", arguments.join(" ")));
        }
        CommandOutcome {
            is_success: self
                .succeeding_programs
                .iter()
                .any(|succeeding| succeeding == program),
            output_text: String::new(),
        }
    }

    fn find_program(&self, _program: &str, _fallback_paths: &[PathBuf]) -> Option<PathBuf> {
        None
    }
}
