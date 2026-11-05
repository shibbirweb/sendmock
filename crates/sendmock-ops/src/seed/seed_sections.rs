/// A part of the seed file: `[settings]`, or a list of items such as `[[numbers]]`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeedSection {
    pub section_path: &'static str,
    pub item_kind: &'static str,
    pub is_item_list: bool,
}

const fn item_list(section_path: &'static str, item_kind: &'static str) -> SeedSection {
    SeedSection {
        section_path,
        item_kind,
        is_item_list: true,
    }
}

pub const SETTINGS_SECTION: SeedSection = SeedSection {
    section_path: "settings",
    item_kind: "Settings",
    is_item_list: false,
};
pub const WEBHOOK_ENDPOINTS_SECTION: SeedSection =
    item_list("webhook.endpoints", "Webhook endpoint");
pub const WEBHOOK_RULES_SECTION: SeedSection = item_list("webhook.rules", "Webhook rule");
pub const WEBHOOK_TEMPLATES_SECTION: SeedSection =
    item_list("webhook.templates", "Webhook template");
pub const WEBHOOK_VARIABLES_SECTION: SeedSection =
    item_list("webhook.variables", "Webhook variable");
pub const SAVED_DELIVERIES_SECTION: SeedSection = item_list("webhook.saved", "Saved delivery");
pub const VERIFY_SERVICES_SECTION: SeedSection = item_list("verify.services", "Verify service");
pub const NUMBERS_SECTION: SeedSection = item_list("numbers", "Virtual number");
pub const MESSAGING_SERVICES_SECTION: SeedSection =
    item_list("messaging_services", "Messaging Service");
pub const SMS_OUTCOME_RULES_SECTION: SeedSection =
    item_list("sms.outcome_rules", "Custom outcome number");
pub const EMAIL_OUTCOME_RULES_SECTION: SeedSection =
    item_list("email.outcome_rules", "Custom outcome address");
pub const EMAIL_PROVIDERS_SECTION: SeedSection = item_list("email.providers", "Email provider");
pub const EMAIL_TEMPLATES_SECTION: SeedSection = item_list("email.templates", "Email template");
pub const SMS_PROVIDERS_SECTION: SeedSection = item_list("sms.providers", "SMS provider");
pub const PAYMENT_FLOWS_SECTION: SeedSection = item_list("payments.flows", "Payment flow");
pub const PAYMENT_METHODS_SECTION: SeedSection = item_list("payments.methods", "Payment method");
pub const PAYMENT_GATEWAYS_SECTION: SeedSection = item_list("payments.gateways", "Payment gateway");

/// Every section a seed file may hold, in the order the summary lists them.
pub const SEED_SECTIONS: [SeedSection; 20] = [
    SETTINGS_SECTION,
    WEBHOOK_ENDPOINTS_SECTION,
    WEBHOOK_RULES_SECTION,
    WEBHOOK_TEMPLATES_SECTION,
    WEBHOOK_VARIABLES_SECTION,
    SAVED_DELIVERIES_SECTION,
    VERIFY_SERVICES_SECTION,
    NUMBERS_SECTION,
    MESSAGING_SERVICES_SECTION,
    item_list("http.bins", "HTTP bin"),
    item_list("email.tag_rules", "Tag rule"),
    item_list("email.forward_rules", "Forward rule"),
    SMS_OUTCOME_RULES_SECTION,
    EMAIL_OUTCOME_RULES_SECTION,
    EMAIL_PROVIDERS_SECTION,
    EMAIL_TEMPLATES_SECTION,
    SMS_PROVIDERS_SECTION,
    PAYMENT_FLOWS_SECTION,
    PAYMENT_METHODS_SECTION,
    PAYMENT_GATEWAYS_SECTION,
];

pub fn find_seed_section(section_path: &str) -> Option<&'static SeedSection> {
    SEED_SECTIONS
        .iter()
        .find(|seed_section| seed_section.section_path == section_path)
}

/// `webhook`, `email` and the other names that only group item lists.
pub fn is_section_group(group_name: &str) -> bool {
    SEED_SECTIONS.iter().any(|seed_section| {
        seed_section
            .section_path
            .split_once('.')
            .is_some_and(|(section_group, _)| section_group == group_name)
    })
}

/// How the section is written in the file, for error messages.
pub fn format_section_header(section_path: &str, is_item_list: bool) -> String {
    if is_item_list {
        format!("[[{section_path}]]")
    } else {
        format!("[{section_path}]")
    }
}
