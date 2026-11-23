//! Java reads its own `cacerts` keystore; `keytool` adds the CA under one alias.

use std::path::PathBuf;
use std::sync::Arc;

use super::command_runner::CommandRunner;
use super::trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};

const KEYSTORE_ALIAS: &str = "sendmock-local-ca";
/// The default password of every JDK's `cacerts`.
const KEYSTORE_PASSWORD: &str = "changeit";

pub struct JavaTarget {
    pub runner: Arc<dyn CommandRunner>,
    pub keytool: PathBuf,
}

/// The JDK's `keytool`, from `JAVA_HOME` or `PATH`; none when Java is not installed.
pub fn find_java_target(runner: &Arc<dyn CommandRunner>) -> Option<JavaTarget> {
    let java_home_keytool = std::env::var_os("JAVA_HOME")
        .map(|java_home| PathBuf::from(java_home).join("bin").join("keytool"));
    runner
        .find_program(
            "keytool",
            &java_home_keytool.into_iter().collect::<Vec<_>>(),
        )
        .map(|keytool| JavaTarget {
            runner: Arc::clone(runner),
            keytool,
        })
}

impl JavaTarget {
    fn run_keytool(&self, arguments: &[&str]) -> super::command_runner::CommandOutcome {
        let mut keystore_arguments = vec!["-cacerts", "-storepass", KEYSTORE_PASSWORD, "-noprompt"];
        keystore_arguments.extend_from_slice(arguments);
        self.runner
            .run(&self.keytool.display().to_string(), &keystore_arguments)
    }
}

impl TrustTarget for JavaTarget {
    fn check(&self, _local_ca: &LocalCa) -> TrustCheck {
        let is_trusted = self
            .run_keytool(&["-list", "-alias", KEYSTORE_ALIAS])
            .is_success;
        TrustCheck {
            place: "Java cacerts".to_owned(),
            state: if is_trusted {
                TrustState::Trusted
            } else {
                TrustState::Missing
            },
            detail: format!("The JDK of {}", self.keytool.display()),
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        let ca_path = local_ca.certificate_path.display().to_string();
        let outcome =
            self.run_keytool(&["-importcert", "-alias", KEYSTORE_ALIAS, "-file", &ca_path]);
        if !outcome.is_success {
            return Err(format!(
                "keytool could not write cacerts ({}); run it again with sudo",
                outcome.output_text.trim()
            ));
        }
        Ok(format!(
            "Added the CA to Java's cacerts as {KEYSTORE_ALIAS}."
        ))
    }

    fn remove(&self, _local_ca: &LocalCa) -> Result<String, String> {
        // On Debian and Ubuntu, rebuilding the system bundle also rebuilds Java's cacerts, so
        // removing the CA from the Linux folder may already have taken the alias out.
        if !self
            .run_keytool(&["-list", "-alias", KEYSTORE_ALIAS])
            .is_success
        {
            return Ok(format!("Java's cacerts no longer holds {KEYSTORE_ALIAS}."));
        }
        let outcome = self.run_keytool(&["-delete", "-alias", KEYSTORE_ALIAS]);
        if !outcome.is_success {
            return Err(outcome.output_text.trim().to_owned());
        }
        Ok(format!("Removed {KEYSTORE_ALIAS} from Java's cacerts."))
    }
}
