use schemars::JsonSchema;
use sendmock_store::OpenRecording;
use serde::Deserialize;

use crate::AppSettings;
use crate::settings::OpenedEventMode;

/// Who opened the message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum OpenSource {
    /// Viewing it in the SendMock UI.
    Ui,
    /// The Simulate open or Simulate read action.
    Manual,
    /// A script calling the API, CLI or MCP tool.
    #[default]
    Api,
}

impl OpenSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ui => "ui",
            Self::Manual => "manual",
            Self::Api => "api",
        }
    }

    /// The email timeline's wording for an open from this source.
    pub fn describe_open(self) -> &'static str {
        match self {
            Self::Ui => "Opened in the SendMock UI",
            Self::Manual => "Opened with Simulate open",
            Self::Api => "Opened through the API",
        }
    }
}

/// Manual and API opens always count (EM-11.3, SM-10.3). A view in the UI counts only while
/// the auto-fire setting is on (EM-11.4), and only the first one unless every open counts
/// (EM-11.1, EM-11.2); `None` means the view is ignored.
pub(crate) fn choose_open_recording(
    open_source: OpenSource,
    app_settings: &AppSettings,
) -> Option<OpenRecording> {
    match open_source {
        OpenSource::Manual | OpenSource::Api => Some(OpenRecording::Always),
        OpenSource::Ui if !app_settings.fire_opened_events_on_view => None,
        OpenSource::Ui => Some(match app_settings.opened_event_mode {
            OpenedEventMode::FirstOpen => OpenRecording::OnlyIfUnopened,
            OpenedEventMode::EveryOpen => OpenRecording::Always,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings_with(fire_opened_events_on_view: bool, mode: OpenedEventMode) -> AppSettings {
        AppSettings {
            fire_opened_events_on_view,
            opened_event_mode: mode,
            ..AppSettings::default()
        }
    }

    // AC: EM-11.1
    #[test]
    fn a_view_counts_only_as_a_first_open_by_default() {
        assert_eq!(
            choose_open_recording(OpenSource::Ui, &AppSettings::default()),
            Some(OpenRecording::OnlyIfUnopened)
        );
    }

    // AC: EM-11.2
    #[test]
    fn every_view_counts_with_every_open() {
        let app_settings = settings_with(true, OpenedEventMode::EveryOpen);

        assert_eq!(
            choose_open_recording(OpenSource::Ui, &app_settings),
            Some(OpenRecording::Always)
        );
    }

    // AC: EM-11.3, EM-11.4, SM-10.3
    #[test]
    fn manual_and_api_opens_count_with_auto_fire_off() {
        let app_settings = settings_with(false, OpenedEventMode::FirstOpen);

        assert_eq!(choose_open_recording(OpenSource::Ui, &app_settings), None);
        assert_eq!(
            choose_open_recording(OpenSource::Manual, &app_settings),
            Some(OpenRecording::Always)
        );
        assert_eq!(
            choose_open_recording(OpenSource::Api, &app_settings),
            Some(OpenRecording::Always)
        );
    }
}
