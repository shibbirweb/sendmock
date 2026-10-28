use std::path::Path;

fn main() {
    let web_index_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web/dist/index.html");
    println!("cargo::rerun-if-changed={}", web_index_path.display());
    let is_release_build = std::env::var("PROFILE").is_ok_and(|profile| profile == "release");
    if is_release_build && !web_index_path.is_file() {
        panic!(
            "web/dist is missing, so the release binary would have no UI. Build it first: cd web && bun install --frozen-lockfile && bun run build"
        );
    }
}
