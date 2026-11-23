//! A preset's setup file filled with the app's URL and paths.

use super::preset_catalog::PresetDefinition;
use crate::OperationError;
use crate::numbers::{field_error, is_http_url};

/// The setup text with `{app_url}` and each `{option}` filled in; options left out take their
/// defaults. A value may hold no quote, backslash or line break, so it stays one TOML string.
pub fn render_preset_setup(
    preset: &PresetDefinition,
    app_url: &str,
    given_options: &std::collections::BTreeMap<String, String>,
) -> Result<String, OperationError> {
    let app_url = app_url.trim().trim_end_matches('/');
    if !is_http_url(app_url) || !is_plain_value(app_url) {
        return Err(field_error(
            "app_url",
            "Enter your app's http:// or https:// URL",
        ));
    }
    if let Some(unknown_option) = given_options.keys().find(|option_name| {
        !preset
            .options
            .iter()
            .any(|option| option.name == option_name.as_str())
    }) {
        return Err(field_error(
            "options",
            &format!("{} has no option {unknown_option}", preset.name),
        ));
    }
    let mut setup_text = preset.setup_template.replace("{app_url}", app_url);
    for preset_option in preset.options {
        let option_value = given_options
            .get(preset_option.name)
            .map_or(preset_option.default_value, String::as_str)
            .trim();
        if !option_value.starts_with('/') || !is_plain_value(option_value) {
            return Err(field_error(
                "options",
                &format!("{} must be a path starting with /", preset_option.name),
            ));
        }
        setup_text = setup_text.replace(&format!("{{{}}}", preset_option.name), option_value);
    }
    Ok(setup_text)
}

/// Reads an option's value: given, or the preset's default.
pub fn read_option<'value>(
    preset: &'value PresetDefinition,
    given_options: &'value std::collections::BTreeMap<String, String>,
    option_name: &str,
) -> &'value str {
    given_options
        .get(option_name)
        .map(|option_value| option_value.trim())
        .or_else(|| {
            preset
                .options
                .iter()
                .find(|preset_option| preset_option.name == option_name)
                .map(|preset_option| preset_option.default_value)
        })
        .unwrap_or_default()
}

fn is_plain_value(value: &str) -> bool {
    !value.contains(['"', '\\', '\n', '\r'])
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::presets::preset_catalog::find_preset;

    // AC: PL-27.2
    #[test]
    fn the_app_url_and_each_path_fill_the_setup_file_with_defaults_for_the_rest() {
        let preset = find_preset("laravel-mailgun-twilio").unwrap_or_else(|| panic!("the preset"));
        let options =
            BTreeMap::from([("mailgun_events_path".to_owned(), "/hooks/mail".to_owned())]);

        let setup_text = render_preset_setup(preset, "http://localhost:8000/", &options)
            .unwrap_or_else(|error| panic!("{error}"));

        assert!(setup_text.contains("url = \"http://localhost:8000/hooks/mail\""));
        assert!(setup_text.contains("url = \"http://localhost:8000/webhooks/mailgun/inbound\""));
        assert!(!setup_text.contains('{'));
    }

    #[test]
    fn a_quote_in_a_value_or_an_unknown_option_is_refused() {
        let preset = find_preset("laravel-mailgun-twilio").unwrap_or_else(|| panic!("the preset"));
        let quoted = BTreeMap::from([("twilio_status_path".to_owned(), "/x\"y".to_owned())]);
        let unknown = BTreeMap::from([("colour".to_owned(), "/x".to_owned())]);

        assert!(render_preset_setup(preset, "http://localhost:8000", &quoted).is_err());
        assert!(render_preset_setup(preset, "http://localhost:8000", &unknown).is_err());
        assert!(render_preset_setup(preset, "ftp://x", &BTreeMap::new()).is_err());
    }
}
