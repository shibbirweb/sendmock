//! Node.js reads its own CA list; `NODE_EXTRA_CA_CERTS` adds the local CA to it.

use super::trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};

pub struct NodeTarget;

impl TrustTarget for NodeTarget {
    fn check(&self, local_ca: &LocalCa) -> TrustCheck {
        let ca_path = local_ca.certificate_path.display().to_string();
        let is_set = std::env::var("NODE_EXTRA_CA_CERTS").is_ok_and(|value| value == ca_path);
        TrustCheck {
            place: "Node.js".to_owned(),
            state: if is_set {
                TrustState::Trusted
            } else {
                TrustState::Manual
            },
            detail: format!("Set NODE_EXTRA_CA_CERTS={ca_path}"),
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        Ok(format!(
            "Set NODE_EXTRA_CA_CERTS={} where your Node app starts.",
            local_ca.certificate_path.display()
        ))
    }

    fn remove(&self, _local_ca: &LocalCa) -> Result<String, String> {
        Ok("Unset NODE_EXTRA_CA_CERTS where you set it.".to_owned())
    }
}
