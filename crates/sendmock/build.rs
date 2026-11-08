use std::path::Path;

/// The channel `sendmock version` reports: `SENDMOCK_RELEASE_CHANNEL` when a release workflow
/// builds the binary, else the `release-channel` file a published crate carries (written by
/// scripts/release/stage-crate-files.sh, so `cargo install` builds report `stable`), else `dev`.
fn main() {
    println!("cargo::rerun-if-env-changed=SENDMOCK_RELEASE_CHANNEL");
    let channel_file = Path::new(env!("CARGO_MANIFEST_DIR")).join("release-channel");
    println!("cargo::rerun-if-changed={}", channel_file.display());
    if std::env::var_os("SENDMOCK_RELEASE_CHANNEL").is_some() {
        return;
    }
    if let Ok(channel_text) = std::fs::read_to_string(&channel_file) {
        println!(
            "cargo::rustc-env=SENDMOCK_RELEASE_CHANNEL={}",
            channel_text.trim()
        );
    }
}
