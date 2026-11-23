//! The operating system's trust store: what browsers, curl and most runtimes read.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::command_runner::CommandRunner;
use super::trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};
use crate::provider_tls::CA_COMMON_NAME;

/// The file name the CA gets in a Linux CA folder.
const LINUX_CA_FILE: &str = "sendmock-local-ca.crt";

/// This machine's system store, or `None` on a system SendMock does not know.
pub fn find_system_store(runner: Arc<dyn CommandRunner>) -> Option<Box<dyn TrustTarget>> {
    match std::env::consts::OS {
        "macos" => Some(Box::new(MacKeychainTarget { runner })),
        "windows" => Some(Box::new(WindowsStoreTarget { runner })),
        "linux" => LinuxCaFolderTarget::find(runner, Path::new("/"))
            .map(|target| Box::new(target) as Box<dyn TrustTarget>),
        _ => None,
    }
}

fn run_checked(
    runner: &dyn CommandRunner,
    program: &str,
    arguments: &[&str],
) -> Result<(), String> {
    let outcome = runner.run(program, arguments);
    if outcome.is_success {
        Ok(())
    } else {
        Err(format!(
            "{program} {}: {}",
            arguments.join(" "),
            outcome.output_text.trim()
        ))
    }
}

/// The login keychain, where `security` adds the CA as a trusted root for this user.
pub struct MacKeychainTarget {
    pub runner: Arc<dyn CommandRunner>,
}

fn login_keychain() -> String {
    dirs::home_dir()
        .unwrap_or_default()
        .join("Library/Keychains/login.keychain-db")
        .display()
        .to_string()
}

impl TrustTarget for MacKeychainTarget {
    fn check(&self, local_ca: &LocalCa) -> TrustCheck {
        let ca_path = local_ca.certificate_path.display().to_string();
        let is_trusted = self
            .runner
            .run("security", &["verify-cert", "-c", &ca_path])
            .is_success;
        TrustCheck {
            place: "macOS keychain".to_owned(),
            state: if is_trusted {
                TrustState::Trusted
            } else {
                TrustState::Missing
            },
            detail: "Your login keychain, read by Safari, Chrome, curl and most apps.".to_owned(),
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        let ca_path = local_ca.certificate_path.display().to_string();
        let keychain = login_keychain();
        let arguments = [
            "add-trusted-cert",
            "-r",
            "trustRoot",
            "-k",
            keychain.as_str(),
            ca_path.as_str(),
        ];
        run_checked(self.runner.as_ref(), "security", &arguments)?;
        Ok("Added the CA to your login keychain as a trusted root.".to_owned())
    }

    fn remove(&self, local_ca: &LocalCa) -> Result<String, String> {
        let ca_path = local_ca.certificate_path.display().to_string();
        let keychain = login_keychain();
        self.runner
            .run("security", &["remove-trusted-cert", &ca_path]);
        run_checked(
            self.runner.as_ref(),
            "security",
            &["delete-certificate", "-c", CA_COMMON_NAME, &keychain],
        )?;
        Ok("Removed the CA from your login keychain.".to_owned())
    }
}

/// The current user's Trusted Root store, which needs no administrator.
pub struct WindowsStoreTarget {
    pub runner: Arc<dyn CommandRunner>,
}

impl TrustTarget for WindowsStoreTarget {
    fn check(&self, _local_ca: &LocalCa) -> TrustCheck {
        let is_trusted = self
            .runner
            .run("certutil", &["-user", "-store", "Root", CA_COMMON_NAME])
            .is_success;
        TrustCheck {
            place: "Windows certificate store".to_owned(),
            state: if is_trusted {
                TrustState::Trusted
            } else {
                TrustState::Missing
            },
            detail: "Your Trusted Root store, read by Edge, Chrome, .NET and most apps.".to_owned(),
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        let ca_path = local_ca.certificate_path.display().to_string();
        run_checked(
            self.runner.as_ref(),
            "certutil",
            &["-user", "-addstore", "Root", &ca_path],
        )?;
        Ok("Added the CA to your Trusted Root store.".to_owned())
    }

    fn remove(&self, _local_ca: &LocalCa) -> Result<String, String> {
        run_checked(
            self.runner.as_ref(),
            "certutil",
            &["-user", "-delstore", "Root", CA_COMMON_NAME],
        )?;
        Ok("Removed the CA from your Trusted Root store.".to_owned())
    }
}

/// A Linux distribution's CA folder and the command that rebuilds the system bundle from it.
pub struct LinuxCaFolderTarget {
    pub runner: Arc<dyn CommandRunner>,
    pub ca_folder: PathBuf,
    pub update_command: &'static [&'static str],
}

/// Debian and Ubuntu, then Fedora and RHEL, then Arch.
const LINUX_LAYOUTS: [(&str, &[&str]); 3] = [
    (
        "usr/local/share/ca-certificates",
        &["update-ca-certificates"],
    ),
    (
        "etc/pki/ca-trust/source/anchors",
        &["update-ca-trust", "extract"],
    ),
    (
        "etc/ca-certificates/trust-source/anchors",
        &["trust", "extract-compat"],
    ),
];

impl LinuxCaFolderTarget {
    /// The first layout whose folder exists under `root_folder` (`/` outside tests).
    pub fn find(runner: Arc<dyn CommandRunner>, root_folder: &Path) -> Option<Self> {
        LINUX_LAYOUTS
            .iter()
            .map(|(folder, update_command)| (root_folder.join(folder), *update_command))
            .find(|(ca_folder, _)| ca_folder.is_dir())
            .map(|(ca_folder, update_command)| Self {
                runner,
                ca_folder,
                update_command,
            })
    }

    fn installed_path(&self) -> PathBuf {
        self.ca_folder.join(LINUX_CA_FILE)
    }

    /// Runs the command as is when this user may write the folder, through `sudo` otherwise.
    fn run_privileged(&self, arguments: &[&str]) -> Result<(), String> {
        let is_writable = std::fs::metadata(&self.ca_folder)
            .is_ok_and(|metadata| !metadata.permissions().readonly())
            && is_root_user();
        match arguments.split_first() {
            Some((program, rest)) if is_writable => {
                run_checked(self.runner.as_ref(), program, rest)
            }
            _ => run_checked(self.runner.as_ref(), "sudo", arguments),
        }
    }
}

fn is_root_user() -> bool {
    std::env::var("USER").is_ok_and(|user_name| user_name == "root")
}

impl TrustTarget for LinuxCaFolderTarget {
    fn check(&self, local_ca: &LocalCa) -> TrustCheck {
        let is_installed = std::fs::read_to_string(self.installed_path())
            .is_ok_and(|installed_pem| installed_pem.trim() == local_ca.certificate_pem.trim());
        TrustCheck {
            place: "Linux CA folder".to_owned(),
            state: if is_installed {
                TrustState::Trusted
            } else {
                TrustState::Missing
            },
            detail: format!(
                "{}, read by curl, OpenSSL and most runtimes.",
                self.ca_folder.display()
            ),
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        let ca_path = local_ca.certificate_path.display().to_string();
        let installed_path = self.installed_path().display().to_string();
        self.run_privileged(&["install", "-m", "644", &ca_path, &installed_path])?;
        self.run_privileged(self.update_command)?;
        Ok(format!(
            "Added the CA as {installed_path} and rebuilt the system bundle."
        ))
    }

    fn remove(&self, _local_ca: &LocalCa) -> Result<String, String> {
        let installed_path = self.installed_path().display().to_string();
        self.run_privileged(&["rm", "-f", &installed_path])?;
        self.run_privileged(self.update_command)?;
        Ok(format!(
            "Removed {installed_path} and rebuilt the system bundle."
        ))
    }
}
