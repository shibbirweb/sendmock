use std::path::Path;

use sendmock_ops::{SeedValidation, validate_seed_toml};

use crate::startup_error::StartupError;

/// Reads and validates the seed file before the server starts, so a broken file stops
/// startup with its line numbers instead of half-applying.
pub fn check_seed_file(seed_file_path: &Path) -> Result<SeedValidation, StartupError> {
    let seed_toml =
        std::fs::read_to_string(seed_file_path).map_err(|source| StartupError::UnreadableSeed {
            file_path: seed_file_path.to_path_buf(),
            source,
        })?;
    let seed_validation = validate_seed_toml(&seed_toml);
    if seed_validation.is_valid {
        return Ok(seed_validation);
    }
    let problems = seed_validation
        .errors
        .iter()
        .map(|seed_error| format!("  line {}: {}", seed_error.line, seed_error.message))
        .collect::<Vec<_>>()
        .join("\n");
    Err(StartupError::InvalidSeed {
        file_path: seed_file_path.to_path_buf(),
        problems,
    })
}
