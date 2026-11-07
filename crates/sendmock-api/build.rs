use std::path::{Path, PathBuf};

/// The UI build to embed: `web/dist` in the repository, else the copy a published crate
/// carries in `web-dist` (put there by scripts/release/stage-crate-files.sh before packaging).
fn locate_web_dist(manifest_directory: &Path) -> PathBuf {
    let repository_web_dist = manifest_directory.join("../../web/dist");
    if repository_web_dist.is_dir() {
        return repository_web_dist;
    }
    manifest_directory.join("web-dist")
}

fn main() {
    let manifest_directory = Path::new(env!("CARGO_MANIFEST_DIR"));
    let web_dist_directory = locate_web_dist(manifest_directory);
    let web_index_path = web_dist_directory.join("index.html");
    println!("cargo::rerun-if-changed={}", web_index_path.display());
    println!(
        "cargo::rustc-env=SENDMOCK_WEB_DIST_DIR={}",
        web_dist_directory.display()
    );
    let is_release_build = std::env::var("PROFILE").is_ok_and(|profile| profile == "release");
    if is_release_build && !web_index_path.is_file() {
        panic!(
            "web/dist is missing, so the release binary would have no UI. Build it first: cd web && bun install --frozen-lockfile && bun run build"
        );
    }
}
