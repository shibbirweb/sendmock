use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use sendmock_ops::{OperationContext, load_template_directory};
use tokio::sync::watch;

/// Often enough that a saved file shows in the gallery right away, rarely enough to cost
/// nothing: reading a directory's file list and times is cheap.
const RELOAD_CHECK_INTERVAL: Duration = Duration::from_secs(2);

/// Each template file's name, size and modification time; a change in any means a reload.
type DirectorySignature = Vec<(PathBuf, u64, Option<SystemTime>)>;

fn read_directory_signature(directory: &Path) -> DirectorySignature {
    let mut signature: DirectorySignature = std::fs::read_dir(directory)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter_map(|entry| {
                    let metadata = entry.metadata().ok()?;
                    Some((entry.path(), metadata.len(), metadata.modified().ok()))
                })
                .filter(|(file_path, _, _)| {
                    file_path
                        .extension()
                        .is_some_and(|extension| extension == "toml")
                })
                .collect()
        })
        .unwrap_or_default();
    signature.sort();
    signature
}

/// Loads `--templates-dir` into the context's file templates, logging files that do not parse.
pub fn load_file_templates(directory: &Path, operation_context: &OperationContext) {
    let loaded = load_template_directory(directory);
    for problem in &loaded.problems {
        tracing::warn!(problem = %problem, "skipped a template file");
    }
    tracing::info!(
        template_count = loaded.templates.len(),
        directory = %directory.display(),
        "loaded webhook template files"
    );
    operation_context
        .file_templates
        .replace_templates(loaded.templates);
}

/// Reloads the templates when a file in the directory is added, changed or removed, until
/// shutdown.
pub async fn run_template_directory_task(
    directory: PathBuf,
    operation_context: OperationContext,
    mut shutdown_requested: watch::Receiver<bool>,
) {
    let mut known_signature = read_directory_signature(&directory);
    let mut reload_timer = tokio::time::interval(RELOAD_CHECK_INTERVAL);
    loop {
        let is_shutting_down = tokio::select! {
            _ = reload_timer.tick() => false,
            _ = shutdown_requested.wait_for(|is_requested| *is_requested) => true,
        };
        if is_shutting_down {
            break;
        }
        let current_signature = read_directory_signature(&directory);
        if current_signature != known_signature {
            load_file_templates(&directory, &operation_context);
            known_signature = current_signature;
        }
    }
}
