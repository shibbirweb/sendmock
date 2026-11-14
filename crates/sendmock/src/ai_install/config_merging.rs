//! Adds SendMock to an agent's existing configuration without dropping anything already there.

use serde_json::{Map, Value, json};

const SECTION_START: &str = "<!-- sendmock:start -->";
const SECTION_END: &str = "<!-- sendmock:end -->";

/// The `sendmock` server under `servers_key` (`mcpServers`, or `servers` for VS Code), with
/// every other entry kept; a file that is not a JSON object starts again from one.
pub fn merge_json_server(existing_text: &str, servers_key: &str, server_entry: Value) -> String {
    let mut document = match serde_json::from_str::<Value>(existing_text) {
        Ok(Value::Object(document_fields)) => document_fields,
        _ => Map::new(),
    };
    let servers = document
        .entry(servers_key.to_owned())
        .or_insert_with(|| json!({}));
    if !servers.is_object() {
        *servers = json!({});
    }
    if let Some(server_entries) = servers.as_object_mut() {
        server_entries.insert("sendmock".to_owned(), server_entry);
    }
    let mut merged_text =
        serde_json::to_string_pretty(&Value::Object(document)).unwrap_or_default();
    merged_text.push('\n');
    merged_text
}

/// Codex's `[mcp_servers.sendmock]` table, replacing one already there and keeping the rest.
pub fn merge_codex_toml(existing_text: &str, sendmock_table: &str) -> String {
    let mut kept_lines: Vec<&str> = Vec::new();
    let mut is_in_sendmock_table = false;
    for line in existing_text.lines() {
        let trimmed_line = line.trim();
        if trimmed_line.starts_with('[') {
            is_in_sendmock_table = trimmed_line == "[mcp_servers.sendmock]";
        }
        if !is_in_sendmock_table {
            kept_lines.push(line);
        }
    }
    let mut merged_text = kept_lines.join("\n").trim_end().to_owned();
    if !merged_text.is_empty() {
        merged_text.push_str("\n\n");
    }
    merged_text.push_str(sendmock_table);
    merged_text
}

/// The instructions between SendMock's markers: replaced where they already are, else added
/// at the end, so the rest of the file stays as the user wrote it.
pub fn merge_markdown_section(existing_text: &str, section_body: &str) -> String {
    let section = format!("{SECTION_START}\n{}\n{SECTION_END}\n", section_body.trim());
    if let (Some(start_index), Some(end_index)) = (
        existing_text.find(SECTION_START),
        existing_text.find(SECTION_END),
    ) && start_index < end_index
    {
        let after_end = &existing_text[end_index + SECTION_END.len()..];
        return format!(
            "{}{section}{}",
            &existing_text[..start_index],
            after_end.trim_start_matches('\n')
        );
    }
    if existing_text.trim().is_empty() {
        return section;
    }
    format!("{}\n\n{section}", existing_text.trim_end())
}

#[cfg(test)]
mod tests {
    use sendmock_ops::ai::McpLaunch;

    use super::*;

    // AC: AI-05.2
    #[test]
    fn json_servers_keep_the_other_entries() {
        let merged = merge_json_server(
            r#"{"theme": "dark", "mcpServers": {"other": {"command": "x"}}}"#,
            "mcpServers",
            json!({"command": "sendmock", "args": ["mcp"]}),
        );
        let merged_value: Value = serde_json::from_str(&merged).unwrap_or(Value::Null);

        assert_eq!(merged_value["theme"], "dark");
        assert_eq!(merged_value["mcpServers"]["other"]["command"], "x");
        assert_eq!(merged_value["mcpServers"]["sendmock"]["args"][0], "mcp");
    }

    // AC: AI-05.2
    #[test]
    fn the_codex_table_is_replaced_and_other_tables_stay() {
        let existing = "model = \"o3\"\n\n[mcp_servers.sendmock]\ncommand = \"old\"\n\n[mcp_servers.other]\ncommand = \"x\"\n";

        let merged = merge_codex_toml(existing, &McpLaunch::Installed.codex_table());

        assert!(merged.contains("model = \"o3\""));
        assert!(merged.contains("[mcp_servers.other]\ncommand = \"x\""));
        assert!(!merged.contains("\"old\""));
        assert_eq!(merged.matches("[mcp_servers.sendmock]").count(), 1);
    }

    // AC: AI-05.2
    #[test]
    fn the_markdown_section_is_replaced_in_place() {
        let first = merge_markdown_section("# My agents\n\nBe kind.\n", "Use SendMock v1.");
        let second = merge_markdown_section(&first, "Use SendMock v2.");

        assert!(
            second.starts_with(
                "# My agents\n\nBe kind.\n\n<!-- sendmock:start -->\nUse SendMock v2.\n"
            )
        );
        assert!(!second.contains("v1"));
        assert_eq!(second.matches(SECTION_START).count(), 1);
    }
}
