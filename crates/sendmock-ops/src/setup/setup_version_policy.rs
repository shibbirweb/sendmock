use super::setup_format_history::find_first_release;
use super::setup_header::{CURRENT_FORMAT_VERSION, SetupHeader};
use super::setup_migration::find_oldest_upgradable_format_version;

/// What happens to a file of a given format version: the one place the UI, REST, CLI and MCP
/// decide it, so every surface answers the same.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SetupVersionPolicy {
    pub current_format_version: i64,
    pub oldest_format_version: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SetupVersionDecision {
    /// The file is this build's format and is applied as it is.
    Current,
    /// An older format, upgraded in memory one step at a time before it is applied.
    Upgrade {
        from_format_version: i64,
        to_format_version: i64,
    },
    /// Written by a newer SendMock: refused before anything is applied.
    TooNew {
        file_format_version: i64,
        exported_by: Option<String>,
    },
    /// Older than the oldest migration this build keeps: refused.
    TooOld { file_format_version: i64 },
}

impl Default for SetupVersionPolicy {
    fn default() -> Self {
        Self {
            current_format_version: CURRENT_FORMAT_VERSION,
            oldest_format_version: find_oldest_upgradable_format_version(CURRENT_FORMAT_VERSION),
        }
    }
}

impl SetupVersionPolicy {
    pub fn decide(&self, setup_header: &SetupHeader) -> SetupVersionDecision {
        let file_format_version = setup_header.format_version;
        if file_format_version > self.current_format_version {
            return SetupVersionDecision::TooNew {
                file_format_version,
                exported_by: setup_header.exported_by.clone(),
            };
        }
        if file_format_version < self.oldest_format_version {
            return SetupVersionDecision::TooOld {
                file_format_version,
            };
        }
        if file_format_version < self.current_format_version {
            return SetupVersionDecision::Upgrade {
                from_format_version: file_format_version,
                to_format_version: self.current_format_version,
            };
        }
        SetupVersionDecision::Current
    }

    /// Why the file is refused, naming the release that wrote it and the one it needs, with
    /// the command that updates this install when one is known; `None` when it is accepted.
    pub fn describe_refusal(
        &self,
        version_decision: &SetupVersionDecision,
        this_version: &str,
        upgrade_command: Option<&str>,
    ) -> Option<String> {
        match version_decision {
            SetupVersionDecision::TooNew {
                file_format_version,
                exported_by,
            } => {
                let needed_release = exported_by.as_deref().unwrap_or("a newer release");
                let exporter = exported_by.as_deref().map_or_else(
                    || "a newer SendMock".to_owned(),
                    |release| format!("SendMock {release}"),
                );
                let update_hint = upgrade_command
                    .map(|command| format!(" Run: {command}"))
                    .unwrap_or_default();
                Some(format!(
                    "This setup was exported by {exporter} (format {file_format_version}); this is SendMock {this_version} (format {}). Update SendMock to {needed_release} or later to import it.{update_hint}",
                    self.current_format_version
                ))
            }
            SetupVersionDecision::TooOld {
                file_format_version,
            } => {
                let reading_release = find_first_release(*file_format_version).map_or_else(
                    || "an older SendMock".to_owned(),
                    |release| format!("SendMock {release}"),
                );
                Some(format!(
                    "This setup uses format {file_format_version}, older than this SendMock {this_version} reads (format {} and later). Import it with {reading_release}, export it again, then import that file here.",
                    self.oldest_format_version
                ))
            }
            SetupVersionDecision::Current | SetupVersionDecision::Upgrade { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const POLICY: SetupVersionPolicy = SetupVersionPolicy {
        current_format_version: 3,
        oldest_format_version: 2,
    };

    fn header(format_version: i64, exported_by: Option<&str>) -> SetupHeader {
        SetupHeader {
            format_version,
            exported_by: exported_by.map(str::to_owned),
        }
    }

    // AC: PL-18.2
    #[test]
    fn applies_the_current_format_as_it_is() {
        assert_eq!(
            POLICY.decide(&header(3, Some("1.6.0"))),
            SetupVersionDecision::Current
        );
    }

    // AC: PL-18.3
    #[test]
    fn upgrades_an_older_format_it_has_migrations_for() {
        assert_eq!(
            POLICY.decide(&header(2, None)),
            SetupVersionDecision::Upgrade {
                from_format_version: 2,
                to_format_version: 3
            }
        );
    }

    // AC: PL-18.4
    #[test]
    fn refuses_a_newer_format_naming_both_releases_and_the_update_command() {
        let version_decision = POLICY.decide(&header(4, Some("1.6.0")));

        let refusal = POLICY.describe_refusal(
            &version_decision,
            "1.4.0",
            Some("brew upgrade shibbirweb/tap/sendmock"),
        );

        assert_eq!(
            refusal.as_deref(),
            Some(
                "This setup was exported by SendMock 1.6.0 (format 4); this is SendMock 1.4.0 (format 3). Update SendMock to 1.6.0 or later to import it. Run: brew upgrade shibbirweb/tap/sendmock"
            )
        );
    }

    // AC: PL-18.4
    #[test]
    fn refuses_a_format_older_than_its_oldest_migration_naming_a_release_that_reads_it() {
        let version_decision = POLICY.decide(&header(1, None));

        let refusal = POLICY.describe_refusal(&version_decision, "1.4.0", None);

        assert_eq!(
            version_decision,
            SetupVersionDecision::TooOld {
                file_format_version: 1
            }
        );
        assert!(
            refusal
                .as_deref()
                .is_some_and(|message| message.contains("Import it with SendMock 0.1.0")),
            "{refusal:?}"
        );
    }
}
