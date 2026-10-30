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

/// Every section a seed file may hold, in the order the summary lists them.
pub const SEED_SECTIONS: [SeedSection; 16] = [
    SeedSection {
        section_path: "settings",
        item_kind: "Settings",
        is_item_list: false,
    },
    item_list("webhook.endpoints", "Webhook endpoint"),
    item_list("webhook.rules", "Webhook rule"),
    item_list("webhook.templates", "Webhook template"),
    item_list("webhook.variables", "Webhook variable"),
    item_list("webhook.saved", "Saved delivery"),
    item_list("verify.services", "Verify service"),
    item_list("numbers", "Virtual number"),
    item_list("messaging_services", "Messaging Service"),
    item_list("http.bins", "HTTP bin"),
    item_list("email.tag_rules", "Tag rule"),
    item_list("email.forward_rules", "Forward rule"),
    item_list("sms.outcome_rules", "Custom outcome number"),
    item_list("email.outcome_rules", "Custom outcome address"),
    item_list("email.providers", "Email provider"),
    item_list("sms.providers", "SMS provider"),
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
