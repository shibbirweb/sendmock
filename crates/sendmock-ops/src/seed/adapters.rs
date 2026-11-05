mod email_outcome_rule_seed_adapter;
mod email_template_seed_adapter;
mod endpoint_names;
mod messaging_service_seed_adapter;
mod payment_definition_seed;
mod payment_flow_seed_adapter;
mod payment_gateway_seed_adapter;
mod payment_method_seed_adapter;
mod saved_delivery_seed_adapter;
mod settings_seed_adapter;
mod sms_outcome_rule_seed_adapter;
mod sms_provider_seed_adapter;
mod verify_service_seed_adapter;
mod virtual_number_seed_adapter;
mod webhook_endpoint_seed_adapter;
mod webhook_rule_seed_adapter;
mod webhook_template_seed_adapter;
mod webhook_variable_seed_adapter;

use email_outcome_rule_seed_adapter::EmailOutcomeRuleSeedAdapter;
use email_template_seed_adapter::EmailTemplateSeedAdapter;
use messaging_service_seed_adapter::MessagingServiceSeedAdapter;
use payment_flow_seed_adapter::PaymentFlowSeedAdapter;
use payment_gateway_seed_adapter::PaymentGatewaySeedAdapter;
use payment_method_seed_adapter::PaymentMethodSeedAdapter;
use saved_delivery_seed_adapter::SavedDeliverySeedAdapter;
use settings_seed_adapter::SettingsSeedAdapter;
use sms_outcome_rule_seed_adapter::SmsOutcomeRuleSeedAdapter;
use sms_provider_seed_adapter::SmsProviderSeedAdapter;
use verify_service_seed_adapter::VerifyServiceSeedAdapter;
use virtual_number_seed_adapter::VirtualNumberSeedAdapter;
use webhook_endpoint_seed_adapter::WebhookEndpointSeedAdapter;
use webhook_rule_seed_adapter::WebhookRuleSeedAdapter;
use webhook_template_seed_adapter::WebhookTemplateSeedAdapter;
use webhook_variable_seed_adapter::WebhookVariableSeedAdapter;

use super::seed_section_adapter::SeedSectionAdapter;

/// Every section SendMock can apply and export, in apply order: a Messaging Service exists
/// before the numbers that join it, and a template before the endpoints that render it, which
/// exist before their variables, rules and saved deliveries; a payment flow exists before the
/// methods that run it, which exist before the gateways that offer them, after the endpoints
/// gateways notify. Sections without an adapter (HTTP
/// bins, tag and forward rules, email providers) are reported and skipped.
pub fn seed_section_adapters() -> Vec<Box<dyn SeedSectionAdapter>> {
    vec![
        Box::new(SettingsSeedAdapter),
        Box::new(VerifyServiceSeedAdapter),
        Box::new(MessagingServiceSeedAdapter),
        Box::new(VirtualNumberSeedAdapter),
        Box::new(SmsOutcomeRuleSeedAdapter),
        Box::new(EmailOutcomeRuleSeedAdapter),
        Box::new(EmailTemplateSeedAdapter),
        Box::new(SmsProviderSeedAdapter),
        Box::new(WebhookTemplateSeedAdapter),
        Box::new(WebhookEndpointSeedAdapter),
        Box::new(WebhookVariableSeedAdapter),
        Box::new(WebhookRuleSeedAdapter),
        Box::new(SavedDeliverySeedAdapter),
        Box::new(PaymentFlowSeedAdapter),
        Box::new(PaymentMethodSeedAdapter),
        Box::new(PaymentGatewaySeedAdapter),
    ]
}
