use schemars::JsonSchema;
use serde::Serialize;

/// The release line a build comes from; it decides which updates are offered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ReleaseChannel {
    Stable,
    Beta,
    Edge,
    Dev,
}

impl ReleaseChannel {
    /// Reads the channel a release build was made for; anything else is a local `dev` build.
    pub fn from_build_setting(build_setting: Option<&str>) -> Self {
        match build_setting {
            Some("stable") => Self::Stable,
            Some("beta") => Self::Beta,
            Some("edge") => Self::Edge,
            _ => Self::Dev,
        }
    }
}

/// Facts about the running instance that operations report but never change.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstanceDetails {
    pub version: &'static str,
    pub channel: ReleaseChannel,
    pub started_at_unix_ms: i64,
    pub http_address: String,
    pub smtp_address: String,
    pub provider_address: Option<String>,
    pub is_container: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_release_channels_and_treats_anything_else_as_dev() {
        assert_eq!(
            ReleaseChannel::from_build_setting(Some("stable")),
            ReleaseChannel::Stable
        );
        assert_eq!(
            ReleaseChannel::from_build_setting(Some("beta")),
            ReleaseChannel::Beta
        );
        assert_eq!(
            ReleaseChannel::from_build_setting(Some("edge")),
            ReleaseChannel::Edge
        );
        assert_eq!(
            ReleaseChannel::from_build_setting(Some("nightly")),
            ReleaseChannel::Dev
        );
        assert_eq!(
            ReleaseChannel::from_build_setting(None),
            ReleaseChannel::Dev
        );
    }
}
