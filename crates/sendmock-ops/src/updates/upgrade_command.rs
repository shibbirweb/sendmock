use schemars::JsonSchema;
use serde::Serialize;

use crate::ReleaseChannel;

const RELEASE_DOWNLOAD_URL: &str =
    "https://github.com/shibbirweb/sendmock/releases/latest/download";

/// How SendMock was installed, baked in by each package; it picks the upgrade command.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum InstallMethod {
    Homebrew,
    Scoop,
    Docker,
    InstallScript,
    Npm,
    Unknown,
}

impl InstallMethod {
    /// Reads the method a package was built for (`SENDMOCK_INSTALL_METHOD`).
    pub fn from_build_setting(build_setting: Option<&str>) -> Self {
        match build_setting {
            Some("homebrew") => Self::Homebrew,
            Some("scoop") => Self::Scoop,
            Some("docker") => Self::Docker,
            Some("install_script") => Self::InstallScript,
            Some("npm") => Self::Npm,
            _ => Self::Unknown,
        }
    }
}

/// The Install page's command that upgrades this install (PL-05.11, PL-05.13); `None` when
/// the method is unknown or does not exist on this platform, so the UI links the release.
pub fn build_upgrade_command(
    install_method: InstallMethod,
    operating_system: &str,
    release_channel: ReleaseChannel,
    offered_version: &str,
) -> Option<String> {
    let is_beta = release_channel == ReleaseChannel::Beta;
    let is_windows = operating_system == "windows";
    let package_name = if is_beta { "sendmock-beta" } else { "sendmock" };
    match install_method {
        InstallMethod::Homebrew if !is_windows => {
            Some(format!("brew upgrade shibbirweb/tap/{package_name}"))
        }
        InstallMethod::Scoop if is_windows => Some(format!("scoop update {package_name}")),
        InstallMethod::Docker => Some(format!(
            "docker pull ghcr.io/shibbirweb/sendmock:{offered_version}"
        )),
        InstallMethod::InstallScript => Some(build_install_script_command(is_windows, is_beta)),
        InstallMethod::Npm => Some(format!("npm install -g sendmock@{offered_version}")),
        InstallMethod::Homebrew | InstallMethod::Scoop | InstallMethod::Unknown => None,
    }
}

fn build_install_script_command(is_windows: bool, is_beta: bool) -> String {
    match (is_windows, is_beta) {
        (true, true) => format!(
            "& ([scriptblock]::Create((irm {RELEASE_DOWNLOAD_URL}/install.ps1))) -Channel beta"
        ),
        (true, false) => format!("irm {RELEASE_DOWNLOAD_URL}/install.ps1 | iex"),
        (false, true) => {
            format!("curl -fsSL {RELEASE_DOWNLOAD_URL}/install.sh | sh -s -- --channel beta")
        }
        (false, false) => format!("curl -fsSL {RELEASE_DOWNLOAD_URL}/install.sh | sh"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-05.13
    #[test]
    fn the_command_fits_the_platform_and_channel() {
        let command = |install_method, operating_system, release_channel| {
            build_upgrade_command(install_method, operating_system, release_channel, "0.2.0")
        };

        assert_eq!(
            command(InstallMethod::Homebrew, "macos", ReleaseChannel::Beta).as_deref(),
            Some("brew upgrade shibbirweb/tap/sendmock-beta")
        );
        assert_eq!(
            command(InstallMethod::Homebrew, "windows", ReleaseChannel::Stable),
            None
        );
        assert_eq!(
            command(InstallMethod::Scoop, "linux", ReleaseChannel::Stable),
            None
        );
        assert_eq!(
            command(InstallMethod::Scoop, "windows", ReleaseChannel::Stable).as_deref(),
            Some("scoop update sendmock")
        );
        assert!(
            command(
                InstallMethod::InstallScript,
                "windows",
                ReleaseChannel::Stable
            )
            .is_some_and(|install_command| install_command.contains("install.ps1"))
        );
        assert!(
            command(InstallMethod::InstallScript, "linux", ReleaseChannel::Beta)
                .is_some_and(|install_command| install_command
                    .ends_with("install.sh | sh -s -- --channel beta"))
        );
        assert_eq!(
            command(InstallMethod::Unknown, "linux", ReleaseChannel::Stable),
            None
        );
    }
}
