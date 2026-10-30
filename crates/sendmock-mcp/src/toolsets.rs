/// The toolsets a harness gets unless it asks for others (docs/plan/14-ai-integration.md).
pub const DEFAULT_TOOLSETS: [&str; 6] = ["core", "email", "sms", "verify", "extract", "webhooks"];

/// The toolset of each tool, by name prefix, as `mcp-toolsets.ts` gives them; the first
/// matching prefix wins, so longer prefixes come first.
const TOOLSET_PREFIXES: [(&str, &str); 26] = [
    ("sendmock_webhook_template_", "templates"),
    ("sendmock_webhook_variable_", "variables"),
    ("sendmock_webhook_", "webhooks"),
    ("sendmock_inbound_route_", "rules"),
    ("sendmock_tag_rule_", "rules"),
    ("sendmock_forward_rule_", "rules"),
    ("sendmock_outcome_rule_", "rules"),
    ("sendmock_email_", "email"),
    ("sendmock_sms_", "sms"),
    ("sendmock_messaging_service_", "numbers"),
    ("sendmock_number_", "numbers"),
    ("sendmock_verify_", "verify"),
    ("sendmock_http_", "http"),
    ("sendmock_logs_", "logs"),
    ("sendmock_payment_", "payments"),
    ("sendmock_checkout_", "payments"),
    ("sendmock_otp_", "extract"),
    ("sendmock_links_", "extract"),
    ("sendmock_scenario_", "scenario"),
    ("sendmock_settings_", "admin"),
    ("sendmock_chaos_", "admin"),
    ("sendmock_reset", "admin"),
    ("sendmock_seed_", "admin"),
    ("sendmock_sample_", "admin"),
    ("sendmock_update_", "admin"),
    ("sendmock_", "core"),
];

pub fn find_toolset(tool_name: &str) -> &'static str {
    TOOLSET_PREFIXES
        .iter()
        .find(|(prefix, _)| tool_name.starts_with(prefix))
        .map_or("core", |(_, toolset)| toolset)
}

/// Which tools a server exposes: `--toolsets` (a list, or `all`) and `--read-only`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolFilter {
    /// `None` exposes every toolset.
    pub toolsets: Option<Vec<String>>,
    pub is_read_only: bool,
}

impl Default for ToolFilter {
    fn default() -> Self {
        Self::from_settings(None, false)
    }
}

impl ToolFilter {
    /// The default toolsets when none are named; `all` for every one.
    pub fn from_settings(toolsets_setting: Option<&str>, is_read_only: bool) -> Self {
        let toolsets = match toolsets_setting.map(str::trim) {
            Some("all") => None,
            Some(toolset_list) => Some(
                toolset_list
                    .split(',')
                    .map(|toolset| toolset.trim().to_owned())
                    .filter(|toolset| !toolset.is_empty())
                    .collect(),
            ),
            None => Some(
                DEFAULT_TOOLSETS
                    .iter()
                    .map(|toolset| (*toolset).to_owned())
                    .collect(),
            ),
        };
        Self {
            toolsets,
            is_read_only,
        }
    }

    pub fn allows(&self, toolset: &str, is_read_only_tool: bool) -> bool {
        let is_toolset_exposed = self.toolsets.as_ref().is_none_or(|toolsets| {
            toolsets
                .iter()
                .any(|exposed_toolset| exposed_toolset == toolset)
        });
        is_toolset_exposed && (is_read_only_tool || !self.is_read_only)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn longer_prefixes_win() {
        assert_eq!(find_toolset("sendmock_webhook_template_list"), "templates");
        assert_eq!(find_toolset("sendmock_webhook_send"), "webhooks");
        assert_eq!(find_toolset("sendmock_otp_get"), "extract");
        assert_eq!(find_toolset("sendmock_status"), "core");
    }

    // AC: AI-02.3
    #[test]
    fn toolsets_and_read_only_limit_the_tools() {
        let default_filter = ToolFilter::default();
        let logs_only = ToolFilter::from_settings(Some("logs"), false);
        let read_only_everything = ToolFilter::from_settings(Some("all"), true);

        assert!(default_filter.allows("email", false));
        assert!(!default_filter.allows("admin", true));
        assert!(logs_only.allows("logs", true));
        assert!(!logs_only.allows("email", true));
        assert!(read_only_everything.allows("admin", true));
        assert!(!read_only_everything.allows("email", false));
    }
}
