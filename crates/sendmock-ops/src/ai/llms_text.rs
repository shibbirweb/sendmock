//! `/llms.txt` and `/llms-full.txt` on the running server: what SendMock is and where agents
//! read more, then the skill and every command, endpoint and tool, from the registry (AI-06.1).

use std::collections::BTreeMap;

use super::skill_files::render_skill_markdown;
use crate::OperationRegistry;

/// The first path segment after `/api/v1`, as the area an endpoint belongs to.
fn read_area(path: &str) -> &str {
    path.trim_start_matches("/api/v1/")
        .split('/')
        .next()
        .unwrap_or("other")
}

fn render_header(sendmock_version: &str) -> String {
    format!(
        "# SendMock\n\n> SendMock {sendmock_version} runs on this machine and catches the email, SMS, payments and HTTP calls an app sends while you develop, and sends back the provider webhooks it expects. It has a JSON REST API under `/api/v1`, a CLI (`sendmock`) and an MCP server (`sendmock mcp` over stdio, or streamable HTTP at `/mcp`).\n\n## Start here\n\n- [Agent skill](/api/v1/ai/skill): the workflows and safety rules for agents\n- [OpenAPI](/api/openapi.json): every endpoint with its inputs and answers\n- [Full reference](/llms-full.txt): the skill and every command, endpoint and tool in one file\n- [AI agent setups](/api/v1/ai/agents): the MCP configuration for Claude Code, Codex, Cursor, Gemini CLI and VS Code\n"
    )
}

/// The index: what SendMock is, where to read more, and each area with an example endpoint.
pub fn render_llms_text(sendmock_version: &str, operation_registry: &OperationRegistry) -> String {
    let mut areas: BTreeMap<&str, (usize, String)> = BTreeMap::new();
    for operation in operation_registry.operations() {
        let definition = operation.definition();
        let area_entry = areas.entry(read_area(definition.path)).or_insert_with(|| {
            (
                0,
                format!(
                    "`{} {}` ({})",
                    definition.method.as_str(),
                    definition.path,
                    definition.summary.trim_end_matches('.')
                ),
            )
        });
        area_entry.0 += 1;
    }
    let area_lines: Vec<String> = areas
        .iter()
        .map(|(area, (operation_count, example))| {
            format!("- {area}: {operation_count} endpoints, such as {example}")
        })
        .collect();
    format!(
        "{}\n## Areas\n\n{}\n",
        render_header(sendmock_version),
        area_lines.join("\n")
    )
}

/// The index, the skill, then every operation with its command, endpoint and tool.
pub fn render_llms_full_text(
    sendmock_version: &str,
    operation_registry: &OperationRegistry,
) -> String {
    let operation_sections: Vec<String> = operation_registry
        .operations()
        .iter()
        .map(|operation| {
            let definition = operation.definition();
            format!(
                "### {}\n\n`sendmock` command: `{}`. Endpoint: `{} {}`. MCP: `{}`.\n",
                definition.summary,
                definition.cli_usage,
                definition.method.as_str(),
                definition.path,
                definition.mcp_tool
            )
        })
        .collect();
    format!(
        "{}\n## Skill\n\n{}\n\n## Commands, endpoints and tools\n\n{}",
        render_llms_text(sendmock_version, operation_registry),
        render_skill_markdown(sendmock_version),
        operation_sections.join("\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-06.1
    #[test]
    fn the_index_and_the_full_text_come_from_the_registry() {
        let operation_registry = crate::build_operation_registry();

        let llms_text = render_llms_text("1.2.3", &operation_registry);
        let llms_full_text = render_llms_full_text("1.2.3", &operation_registry);

        assert!(llms_text.starts_with("# SendMock\n\n> SendMock 1.2.3 runs on this machine"));
        assert!(llms_text.contains("- [Full reference](/llms-full.txt)"));
        assert!(llms_text.contains("- emails: "), "{llms_text}");
        assert!(llms_full_text.contains("## Skill\n\n---\nname: sendmock"));
        assert!(llms_full_text.contains(
            "`sendmock` command: `sendmock payments subscriptions advance <subscriptionId>`."
        ));
        assert_eq!(
            llms_full_text.matches("`sendmock` command: `").count(),
            operation_registry.operations().len()
        );
    }
}
