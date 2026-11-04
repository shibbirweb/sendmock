mod email_outcome_rule_seed_adapter;
mod messaging_service_seed_adapter;
mod settings_seed_adapter;
mod sms_outcome_rule_seed_adapter;
mod verify_service_seed_adapter;
mod virtual_number_seed_adapter;

use email_outcome_rule_seed_adapter::EmailOutcomeRuleSeedAdapter;
use messaging_service_seed_adapter::MessagingServiceSeedAdapter;
use settings_seed_adapter::SettingsSeedAdapter;
use sms_outcome_rule_seed_adapter::SmsOutcomeRuleSeedAdapter;
use verify_service_seed_adapter::VerifyServiceSeedAdapter;
use virtual_number_seed_adapter::VirtualNumberSeedAdapter;

use super::seed_section_adapter::SeedSectionAdapter;

/// Every section SendMock can apply and export, in apply order: a Messaging Service exists
/// before the numbers that join it. Sections without an adapter are reported and skipped.
pub fn seed_section_adapters() -> Vec<Box<dyn SeedSectionAdapter>> {
    vec![
        Box::new(SettingsSeedAdapter),
        Box::new(VerifyServiceSeedAdapter),
        Box::new(MessagingServiceSeedAdapter),
        Box::new(VirtualNumberSeedAdapter),
        Box::new(SmsOutcomeRuleSeedAdapter),
        Box::new(EmailOutcomeRuleSeedAdapter),
    ]
}
