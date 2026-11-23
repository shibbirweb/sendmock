use std::path::PathBuf;
use std::sync::Mutex;

use super::command_runner::{CommandOutcome, CommandRunner};

/// Answers each program with a fixed outcome and records every call.
#[derive(Default)]
pub struct FakeCommandRunner {
    pub succeeding_programs: Vec<String>,
    /// What a program prints, by program; nothing for the others.
    pub program_outputs: Vec<(String, String)>,
    pub calls: Mutex<Vec<String>>,
}

impl FakeCommandRunner {
    pub fn succeeding(programs: &[&str]) -> Self {
        Self {
            succeeding_programs: programs
                .iter()
                .map(|program| (*program).to_owned())
                .collect(),
            program_outputs: Vec::new(),
            calls: Mutex::new(Vec::new()),
        }
    }

    /// The same runner, with `program` printing `output_text`.
    pub fn with_output(mut self, program: &str, output_text: &str) -> Self {
        self.program_outputs
            .push((program.to_owned(), output_text.to_owned()));
        self
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
            output_text: self
                .program_outputs
                .iter()
                .find(|(output_program, _)| output_program == program)
                .map(|(_, output_text)| output_text.clone())
                .unwrap_or_default(),
        }
    }

    fn find_program(&self, _program: &str, _fallback_paths: &[PathBuf]) -> Option<PathBuf> {
        None
    }
}
