/// A part of the seed file: `[settings]`, or a list of items such as `[[numbers]]`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeedSection {
    pub section_path: &'static str,
    pub item_kind: &'static str,
    pub is_item_list: bool,
    /// The fields an item is matched by across applies, each with the value a file may leave
    /// out; joined with spaces they give the key the section's adapter answers.
    pub key_fields: &'static [ItemKeyField],
}

/// One field of an item's key and its value when the file leaves it out.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ItemKeyField {
    pub field_name: &'static str,
    pub default_value: &'static str,
}

const fn key_field(field_name: &'static str) -> ItemKeyField {
    ItemKeyField {
        field_name,
        default_value: "",
    }
}

const NAME_KEY: &[ItemKeyField] = &[key_field("name")];
const KEY_KEY: &[ItemKeyField] = &[key_field("key")];
const SID_KEY: &[ItemKeyField] = &[key_field("sid")];
const ID_KEY: &[ItemKeyField] = &[key_field("id")];

const fn item_list(
    section_path: &'static str,
    item_kind: &'static str,
    key_fields: &'static [ItemKeyField],
) -> SeedSection {
    SeedSection {
        section_path,
        item_kind,
        is_item_list: true,
        key_fields,
    }
}

/// The key of the section's one settings item, as its adapter answers it.
pub const SETTINGS_ITEM_KEY: &str = "settings";

pub const SETTINGS_SECTION: SeedSection = SeedSection {
    section_path: "settings",
    item_kind: "Settings",
    is_item_list: false,
    key_fields: &[],
};
pub const PROJECTS_SECTION: SeedSection = item_list("projects", "Project", KEY_KEY);
pub const WEBHOOK_ENDPOINTS_SECTION: SeedSection =
    item_list("webhook.endpoints", "Webhook endpoint", NAME_KEY);
pub const WEBHOOK_RULES_SECTION: SeedSection = item_list("webhook.rules", "Webhook rule", NAME_KEY);
pub const WEBHOOK_TEMPLATES_SECTION: SeedSection =
    item_list("webhook.templates", "Webhook template", ID_KEY);
pub const WEBHOOK_VARIABLES_SECTION: SeedSection = item_list(
    "webhook.variables",
    "Webhook variable",
    &[key_field("endpoint"), key_field("name")],
);
pub const SAVED_DELIVERIES_SECTION: SeedSection =
    item_list("webhook.saved", "Saved delivery", NAME_KEY);
pub const VERIFY_SERVICES_SECTION: SeedSection =
    item_list("verify.services", "Verify service", SID_KEY);
pub const NUMBERS_SECTION: SeedSection =
    item_list("numbers", "Virtual number", &[key_field("number")]);
pub const MESSAGING_SERVICES_SECTION: SeedSection =
    item_list("messaging_services", "Messaging Service", SID_KEY);
pub const SMS_OUTCOME_RULES_SECTION: SeedSection = item_list(
    "sms.outcome_rules",
    "Custom outcome number",
    &[
        ItemKeyField {
            field_name: "match",
            default_value: "to",
        },
        key_field("pattern"),
    ],
);
pub const EMAIL_OUTCOME_RULES_SECTION: SeedSection = item_list(
    "email.outcome_rules",
    "Custom outcome address",
    &[key_field("pattern")],
);
pub const EMAIL_PROVIDERS_SECTION: SeedSection =
    item_list("email.providers", "Email provider", KEY_KEY);
pub const EMAIL_TEMPLATES_SECTION: SeedSection =
    item_list("email.templates", "Email template", ID_KEY);
pub const SMS_PROVIDERS_SECTION: SeedSection = item_list("sms.providers", "SMS provider", KEY_KEY);
pub const TWILIO_SUBACCOUNTS_SECTION: SeedSection =
    item_list("sms.twilio_subaccounts", "Twilio subaccount", SID_KEY);
pub const PAYMENT_FLOWS_SECTION: SeedSection = item_list("payments.flows", "Payment flow", KEY_KEY);
pub const PAYMENT_METHODS_SECTION: SeedSection =
    item_list("payments.methods", "Payment method", KEY_KEY);
pub const PAYMENT_GATEWAYS_SECTION: SeedSection =
    item_list("payments.gateways", "Payment gateway", KEY_KEY);
pub const HTTP_BINS_SECTION: SeedSection = item_list("http.bins", "HTTP bin", NAME_KEY);
pub const PROVIDER_BINS_SECTION: SeedSection = item_list(
    "http.provider_bins",
    "Provider bin",
    &[key_field("area"), key_field("provider")],
);
pub const TAG_RULES_SECTION: SeedSection = item_list("email.tag_rules", "Tag rule", NAME_KEY);
pub const FORWARD_RULES_SECTION: SeedSection =
    item_list("email.forward_rules", "Forward rule", NAME_KEY);
pub const INBOUND_ROUTES_SECTION: SeedSection = item_list(
    "email.inbound_routes",
    "Inbound route",
    &[key_field("description")],
);
pub const SCENARIOS_SECTION: SeedSection = item_list("scenarios", "Saved scenario", NAME_KEY);

/// Every section a seed file may hold, in the order the summary lists them.
pub const SEED_SECTIONS: [SeedSection; 25] = [
    SETTINGS_SECTION,
    PROJECTS_SECTION,
    WEBHOOK_ENDPOINTS_SECTION,
    WEBHOOK_RULES_SECTION,
    WEBHOOK_TEMPLATES_SECTION,
    WEBHOOK_VARIABLES_SECTION,
    SAVED_DELIVERIES_SECTION,
    VERIFY_SERVICES_SECTION,
    NUMBERS_SECTION,
    MESSAGING_SERVICES_SECTION,
    HTTP_BINS_SECTION,
    PROVIDER_BINS_SECTION,
    TAG_RULES_SECTION,
    FORWARD_RULES_SECTION,
    INBOUND_ROUTES_SECTION,
    SMS_OUTCOME_RULES_SECTION,
    EMAIL_OUTCOME_RULES_SECTION,
    EMAIL_PROVIDERS_SECTION,
    EMAIL_TEMPLATES_SECTION,
    SMS_PROVIDERS_SECTION,
    TWILIO_SUBACCOUNTS_SECTION,
    PAYMENT_FLOWS_SECTION,
    PAYMENT_METHODS_SECTION,
    PAYMENT_GATEWAYS_SECTION,
    SCENARIOS_SECTION,
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

/// The key an item of the section is matched by, as its adapter answers it: the key fields'
/// trimmed values joined with spaces, so a file item and a stored item compare equal.
pub fn read_item_key(seed_section: &SeedSection, item_table: &toml::Table) -> String {
    if !seed_section.is_item_list {
        return SETTINGS_ITEM_KEY.to_owned();
    }
    seed_section
        .key_fields
        .iter()
        .map(|key_field| {
            item_table
                .get(key_field.field_name)
                .and_then(toml::Value::as_str)
                .map_or(key_field.default_value, str::trim)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// How the section is written in the file, for error messages.
pub fn format_section_header(section_path: &str, is_item_list: bool) -> String {
    if is_item_list {
        format!("[[{section_path}]]")
    } else {
        format!("[{section_path}]")
    }
}
