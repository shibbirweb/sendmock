use std::path::PathBuf;

/// The local CA a trust target adds or checks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalCa {
    pub certificate_path: PathBuf,
    pub certificate_pem: String,
    /// Where `sendmock trust` keeps the bundles it writes.
    pub bundle_folder: PathBuf,
}

/// Whether one place trusts the local CA.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrustState {
    Trusted,
    Missing,
    /// SendMock cannot change it; `detail` says the line or command to run.
    Manual,
}

impl TrustState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Trusted => "trusted",
            Self::Missing => "missing",
            Self::Manual => "manual",
        }
    }
}

/// One place's state, with what it is and what to do.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrustCheck {
    pub place: String,
    pub state: TrustState,
    pub detail: String,
}

/// A place that can trust the local CA: the system store or a language runtime. Each one
/// checks, adds and removes on its own, so `sendmock trust` only walks the list.
pub trait TrustTarget {
    fn check(&self, local_ca: &LocalCa) -> TrustCheck;

    /// Adds the CA; what changed, or why it could not.
    fn add(&self, local_ca: &LocalCa) -> Result<String, String>;

    /// Removes what `add` added; what changed, or why it could not.
    fn remove(&self, local_ca: &LocalCa) -> Result<String, String>;

    /// For a place SendMock does not change: prepares what the user sets by hand (such as a
    /// combined CA bundle) and says what to set; `None` when there is nothing to do.
    fn prepare_manual_step(&self, _local_ca: &LocalCa) -> Option<Result<String, String>> {
        None
    }

    /// For `sendmock trust --bundle-only`: writes this place's combined CA bundle in SendMock's
    /// trust folder and says where, changing nothing else; `None` for places with no bundle.
    fn write_bundle_only(&self, _local_ca: &LocalCa) -> Option<Result<String, String>> {
        None
    }
}
