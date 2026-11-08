use std::sync::LazyLock;

use serde::Deserialize;

use super::http_catcher_wire::{HttpBinPreset, HttpMockResponse};

/// Exported from the mock's `http-bin-presets.ts`, so both answer the same.
const HTTP_BIN_PRESETS_JSON: &str = include_str!("../../builtin/http-bin-presets.json");

#[derive(Deserialize)]
struct PresetDefinition {
    preset: HttpBinPreset,
    default_response: HttpMockResponse,
}

#[derive(Deserialize)]
struct PresetCatalogue {
    plain_default_response: HttpMockResponse,
    presets: Vec<PresetDefinition>,
}

static PRESET_CATALOGUE: LazyLock<Option<PresetCatalogue>> =
    LazyLock::new(|| serde_json::from_str(HTTP_BIN_PRESETS_JSON).ok());

/// The reply of a bin without a preset: `200 {"ok":true}` (HC-02.1).
pub fn plain_default_response() -> HttpMockResponse {
    PRESET_CATALOGUE
        .as_ref()
        .map(|catalogue| catalogue.plain_default_response.clone())
        .unwrap_or_else(|| HttpMockResponse {
            status_code: 200,
            headers: [("content-type".to_owned(), "application/json".to_owned())].into(),
            body: r#"{"ok":true}"#.to_owned(),
        })
}

/// What a bin of this preset answers until its default reply is changed.
pub fn preset_default_response(preset: Option<HttpBinPreset>) -> HttpMockResponse {
    preset
        .and_then(|preset| {
            PRESET_CATALOGUE
                .as_ref()?
                .presets
                .iter()
                .find(|definition| definition.preset == preset)
        })
        .map_or_else(plain_default_response, |definition| {
            definition.default_response.clone()
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: HC-02.1
    #[test]
    fn a_plain_bin_answers_ok_and_a_slack_bin_answers_as_slack_does() {
        assert_eq!(plain_default_response().body, r#"{"ok":true}"#);
        assert_eq!(
            preset_default_response(Some(HttpBinPreset::Slack)).body,
            "ok"
        );
        assert_eq!(
            preset_default_response(Some(HttpBinPreset::Discord)).status_code,
            204
        );
    }
}
