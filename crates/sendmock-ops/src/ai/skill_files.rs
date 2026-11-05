/// `SKILL.md` as written in the repository; the version is filled in when it is served.
const SKILL_TEMPLATE: &str = include_str!("../../../../skill/sendmock/SKILL.md");
const VERSION_PLACEHOLDER: &str = "{{sendmock_version}}";

/// The skill's example scenarios, by file name, as `sendmock ai install` writes them.
pub const SKILL_EXAMPLES: [(&str, &str); 3] = [
    (
        "otp-from-sms.toml",
        include_str!("../../../../skill/sendmock/examples/otp-from-sms.toml"),
    ),
    (
        "reply-by-email.toml",
        include_str!("../../../../skill/sendmock/examples/reply-by-email.toml"),
    ),
    (
        "stripe-checkout.toml",
        include_str!("../../../../skill/sendmock/examples/stripe-checkout.toml"),
    ),
];

/// The skill for this binary's version (AI-05.1).
pub fn render_skill_markdown(sendmock_version: &str) -> String {
    SKILL_TEMPLATE.replace(VERSION_PLACEHOLDER, sendmock_version)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The MCP tools the skill's workflows name, in the order they first appear.
    fn list_named_tools(skill_markdown: &str) -> Vec<String> {
        let mut named_tools: Vec<String> = Vec::new();
        for code_span in skill_markdown.split('`').skip(1).step_by(2) {
            let is_tool_name = code_span.starts_with("sendmock_")
                && code_span
                    .chars()
                    .all(|character| character.is_ascii_lowercase() || character == '_');
            if is_tool_name && !named_tools.iter().any(|named_tool| named_tool == code_span) {
                named_tools.push(code_span.to_owned());
            }
        }
        named_tools
    }

    // AC: AI-05.1
    #[test]
    fn the_skill_names_this_version() {
        let skill_markdown = render_skill_markdown("1.2.3");

        assert!(skill_markdown.starts_with("---\nname: sendmock\n"));
        assert!(skill_markdown.contains("Written for SendMock 1.2.3."));
        assert!(!skill_markdown.contains(VERSION_PLACEHOLDER));
    }

    // AC: EM-18.6 SM-16.6 PY-12.5
    #[test]
    fn every_tool_the_workflows_name_exists() {
        let skill_markdown = render_skill_markdown("1.2.3");
        let tool_names: Vec<String> = crate::build_operation_registry()
            .operations()
            .iter()
            .flat_map(|operation| {
                let definition = operation.definition();
                std::iter::once(definition.mcp_tool)
                    .chain(definition.mcp_aliases.iter().copied())
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .collect();

        let named_tools = list_named_tools(&skill_markdown);
        let unknown_tools: Vec<&String> = named_tools
            .iter()
            .filter(|named_tool| !tool_names.contains(named_tool))
            .collect();

        assert!(named_tools.len() > 30, "{named_tools:?}");
        assert!(unknown_tools.is_empty(), "{unknown_tools:?}");
        for workflow_heading in [
            "### add-payment-gateway",
            "### add-payment-flow",
            "### add-email-provider",
            "### add-sms-provider",
        ] {
            assert!(
                skill_markdown.contains(workflow_heading),
                "{workflow_heading}"
            );
        }
    }
}
