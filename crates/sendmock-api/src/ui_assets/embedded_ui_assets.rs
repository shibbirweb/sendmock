use rust_embed::Embed;

use super::{UiAsset, UiAssets};

/// Release builds compile `web/dist` into the binary; debug builds read it from disk, so a
/// UI rebuild needs no Rust rebuild. A missing folder only fails release builds (build.rs).
#[derive(Embed)]
#[folder = "../../web/dist/"]
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
