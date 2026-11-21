use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::ProviderBinRecord;
use serde::{Deserialize, Serialize};

use super::provider_area::ProviderArea;

/// An HTTP Catcher bin attached to a provider: requests on the provider's base URL that no
/// built-in operation answers are captured there and answered by the bin's rules.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ProviderBin {
    pub area: ProviderArea,
    pub provider_key: String,
    pub bin_id: String,
    pub bin_name: String,
    pub attached_at: String,
}

impl ProviderBin {
    /// `None` for a row whose area this build does not know.
    pub fn from_record(stored_provider_bin: ProviderBinRecord) -> Option<Self> {
        Some(Self {
            area: ProviderArea::parse(&stored_provider_bin.area)?,
            provider_key: stored_provider_bin.provider_key,
            bin_id: stored_provider_bin.bin_id,
            bin_name: stored_provider_bin.bin_name,
            attached_at: format_rfc3339(stored_provider_bin.created_at_unix_ms),
        })
    }
}

/// A provider, by its area and key.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProviderBinReference {
    /// `email`, `sms`, `push` or `payments`.
    pub area: ProviderArea,
    /// The provider's key, such as `twilio` or `stripe`.
    pub provider_key: String,
}

/// Body of `PUT /api/v1/provider-bins/{area}/{providerKey}`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProviderBinAttachment {
    /// `email`, `sms`, `push` or `payments`.
    pub area: ProviderArea,
    /// The provider's key, such as `twilio` or `stripe`.
    pub provider_key: String,
    /// The bin's name; a bin of that name is made when there is none.
    pub bin_name: String,
}
