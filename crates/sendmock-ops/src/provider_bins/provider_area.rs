use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::providers::{EMAIL_PROVIDER_AREA, SMS_PROVIDER_AREA, load_area_providers};
use crate::push::PUSH_PROVIDER_KEYS;
use crate::{OperationContext, OperationError};

/// Where a provider lives: email and SMS providers (Verify services among them), push services
/// and payment gateways.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ProviderArea {
    Email,
    Sms,
    Push,
    Payments,
}

impl ProviderArea {
    pub const ALL: [Self; 4] = [Self::Email, Self::Sms, Self::Push, Self::Payments];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Email => EMAIL_PROVIDER_AREA,
            Self::Sms => SMS_PROVIDER_AREA,
            Self::Push => "push",
            Self::Payments => "payments",
        }
    }

    pub fn parse(area_text: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|area| area.as_str() == area_text)
    }

    /// Whether the area has a provider with this key that is not removed.
    pub async fn has_provider(
        self,
        operation_context: &OperationContext,
        provider_key: &str,
    ) -> Result<bool, OperationError> {
        match self {
            Self::Email | Self::Sms => Ok(load_area_providers(operation_context, self.as_str())
                .await?
                .iter()
                .any(|provider| provider.key == provider_key && !provider.is_removed)),
            Self::Push => Ok(PUSH_PROVIDER_KEYS.contains(&provider_key)),
            Self::Payments => Ok(crate::payments::load_payment_gateways(operation_context)
                .await?
                .iter()
                .any(|payment_gateway| payment_gateway.fields.key == provider_key)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_area_reads_back_from_its_name() {
        for area in ProviderArea::ALL {
            assert_eq!(ProviderArea::parse(area.as_str()), Some(area));
        }
        assert_eq!(ProviderArea::parse("storage"), None);
    }
}
