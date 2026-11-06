use rust_embed::Embed;

use super::{UiAsset, UiAssets};

/// Release builds compile `web/dist` into the binary; debug builds read it from disk, so a
/// UI rebuild needs no Rust rebuild. A missing folder only fails release builds. build.rs
/// names the folder: `web/dist`, or the copy a published crate carries.
#[derive(Embed)]
#[folder = "$SENDMOCK_WEB_DIST_DIR/"]
#[allow_missing = true]
struct WebDistFiles;

#[derive(Debug, Default, Clone, Copy)]
pub struct EmbeddedUiAssets;

impl UiAssets for EmbeddedUiAssets {
    fn find_asset(&self, asset_path: &str) -> Option<UiAsset> {
        WebDistFiles::get(asset_path).map(|embedded_file| UiAsset {
            content_type: embedded_file.metadata.mimetype().to_owned(),
            bytes: embedded_file.data,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The folder comes from build.rs through an environment variable, and `allow_missing`
    // would hide a wrong one, so the UI's entry page must be found whenever it was built.
    #[test]
    fn finds_the_built_ui_through_the_folder_build_rs_names() {
        let index_path = std::path::Path::new(env!("SENDMOCK_WEB_DIST_DIR")).join("index.html");
        if !index_path.is_file() {
            return;
        }

        assert!(EmbeddedUiAssets.find_asset("index.html").is_some());
    }
}
