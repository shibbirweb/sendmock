//! Python's `requests` and `httpx` read `certifi`'s bundle, which an upgrade replaces, so
//! SendMock writes a combined copy and prints the lines that point Python at it.

use std::path::PathBuf;
use std::sync::Arc;

use super::command_runner::CommandRunner;
use super::trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};

const BUNDLE_FILE: &str = "python-ca-bundle.pem";

pub struct PythonTarget {
    pub runner: Arc<dyn CommandRunner>,
    pub python: PathBuf,
}

/// `python3` with `certifi` installed; none otherwise.
pub fn find_python_target(runner: &Arc<dyn CommandRunner>) -> Option<PythonTarget> {
    let python = runner
        .find_program("python3", &[])
        .or_else(|| runner.find_program("python", &[]))?;
    Some(PythonTarget {
        runner: Arc::clone(runner),
        python,
    })
}

impl PythonTarget {
    fn read_certifi_path(&self) -> Option<String> {
        let outcome = self.runner.run(
            &self.python.display().to_string(),
            &["-c", "import certifi; print(certifi.where())"],
        );
        outcome
            .is_success
            .then(|| outcome.output_text.trim().to_owned())
            .filter(|certifi_path| !certifi_path.is_empty())
    }

    fn describe_lines(bundle_path: &str) -> String {
        format!("Set SSL_CERT_FILE={bundle_path} and REQUESTS_CA_BUNDLE={bundle_path}")
    }
}

impl TrustTarget for PythonTarget {
    fn check(&self, local_ca: &LocalCa) -> TrustCheck {
        let bundle_path = local_ca
            .bundle_folder
            .join(BUNDLE_FILE)
            .display()
            .to_string();
        let is_pointed = std::env::var("SSL_CERT_FILE").is_ok_and(|value| value == bundle_path)
            || std::env::var("REQUESTS_CA_BUNDLE").is_ok_and(|value| value == bundle_path);
        let has_certifi = self.read_certifi_path().is_some();
        let (state, detail) = match (has_certifi, is_pointed) {
            (false, _) => (
                TrustState::Trusted,
                "certifi is not installed; Python reads the system store.".to_owned(),
            ),
            (true, true) => (TrustState::Trusted, format!("Pointed at {bundle_path}")),
            (true, false) => (TrustState::Manual, Self::describe_lines(&bundle_path)),
        };
        TrustCheck {
            place: format!("Python certifi ({})", self.python.display()),
            state,
            detail,
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        let Some(certifi_path) = self.read_certifi_path() else {
            return Ok("certifi is not installed; Python reads the system store.".to_owned());
        };
        let certifi_pem =
            std::fs::read_to_string(&certifi_path).map_err(|error| error.to_string())?;
        let bundle_path = local_ca.bundle_folder.join(BUNDLE_FILE);
        std::fs::create_dir_all(&local_ca.bundle_folder).map_err(|error| error.to_string())?;
        std::fs::write(
            &bundle_path,
            format!("{}\n{}", certifi_pem.trim_end(), local_ca.certificate_pem),
        )
        .map_err(|error| error.to_string())?;
        Ok(format!(
            "Wrote {}. {}",
            bundle_path.display(),
            Self::describe_lines(&bundle_path.display().to_string())
        ))
    }

    fn remove(&self, local_ca: &LocalCa) -> Result<String, String> {
        let bundle_path = local_ca.bundle_folder.join(BUNDLE_FILE);
        if bundle_path.exists() {
            std::fs::remove_file(&bundle_path).map_err(|error| error.to_string())?;
        }
        Ok(format!("Removed {}.", bundle_path.display()))
    }
}
