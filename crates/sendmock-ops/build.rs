use std::path::{Path, PathBuf};

/// The agent skill to embed: `skill/sendmock` in the repository, else the copy a published crate
/// carries in `skill` (put there by scripts/release/stage-crate-files.sh before packaging).
fn locate_skill_directory(manifest_directory: &Path) -> PathBuf {
    let repository_skill_directory = manifest_directory.join("../../skill/sendmock");
    if repository_skill_directory.is_dir() {
        return repository_skill_directory;
    }
    manifest_directory.join("skill")
}

fn main() {
    let manifest_directory = Path::new(env!("CARGO_MANIFEST_DIR"));
    let skill_directory = locate_skill_directory(manifest_directory);
    println!("cargo::rerun-if-changed={}", skill_directory.display());
    println!(
        "cargo::rustc-env=SENDMOCK_SKILL_DIR={}",
        skill_directory.display()
    );
}
