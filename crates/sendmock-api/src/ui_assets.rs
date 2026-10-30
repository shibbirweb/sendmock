mod embedded_ui_assets;
#[cfg(test)]
mod in_memory_ui_assets;

use std::borrow::Cow;

pub use embedded_ui_assets::EmbeddedUiAssets;
#[cfg(test)]
pub use in_memory_ui_assets::InMemoryUiAssets;

#[derive(Debug, Clone)]
pub struct UiAsset {
    pub bytes: Cow<'static, [u8]>,
    pub content_type: String,
}

/// Where the web UI's files come from: compiled into the binary, or a fake in tests.
pub trait UiAssets: Send + Sync {
    fn find_asset(&self, asset_path: &str) -> Option<UiAsset>;
}
