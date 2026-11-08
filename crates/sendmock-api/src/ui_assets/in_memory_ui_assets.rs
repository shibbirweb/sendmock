use std::borrow::Cow;
use std::collections::HashMap;

use super::{UiAsset, UiAssets};

#[derive(Debug, Default, Clone)]
pub struct InMemoryUiAssets {
    assets_by_path: HashMap<String, UiAsset>,
}

impl InMemoryUiAssets {
    pub fn with_asset(
        mut self,
        asset_path: &str,
        content_type: &str,
        content: &'static str,
    ) -> Self {
        self.assets_by_path.insert(
            asset_path.to_owned(),
            UiAsset {
                bytes: Cow::Borrowed(content.as_bytes()),
                content_type: content_type.to_owned(),
            },
        );
        self
    }
}

impl UiAssets for InMemoryUiAssets {
    fn find_asset(&self, asset_path: &str) -> Option<UiAsset> {
        self.assets_by_path.get(asset_path).cloned()
    }
}
