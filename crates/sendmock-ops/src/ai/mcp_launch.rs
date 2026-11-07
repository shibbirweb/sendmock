use serde_json::{Value, json};

/// How an AI agent starts SendMock's MCP server: the installed binary, or through npx for
/// people who run SendMock with no install (AI-05.9). Every configuration SendMock writes or
/// shows comes from here, so the two cannot drift.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpLaunch {
    Installed,
    Npx,
}

impl McpLaunch {
    pub fn command(self) -> &'static str {
        match self {
            Self::Installed => "sendmock",
            Self::Npx => "npx",
        }
    }

    pub fn arguments(self) -> &'static [&'static str] {
        match self {
            Self::Installed => &["mcp"],
            // `-y` installs the package without asking, since an agent cannot answer.
            Self::Npx => &["-y", "sendmock", "mcp"],
        }
    }

    /// The command and its arguments as one line, as a shell or Claude Code takes them.
    pub fn command_line(self) -> String {
        std::iter::once(self.command())
            .chain(self.arguments().iter().copied())
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// `{"command": ..., "args": [...]}`, the stdio server entry of a JSON MCP configuration.
    pub fn stdio_server_entry(self) -> Value {
        json!({ "command": self.command(), "args": self.arguments() })
    }

    pub fn claude_code_command(self) -> String {
        format!("claude mcp add sendmock -- {}", self.command_line())
    }

    /// Codex's `[mcp_servers.sendmock]` table, ending in a newline.
    pub fn codex_table(self) -> String {
        let quoted_arguments = self
            .arguments()
            .iter()
            .map(|argument| format!("\"{argument}\""))
            .collect::<Vec<_>>()
            .join(", ");
        format!(
            "[mcp_servers.sendmock]\ncommand = \"{}\"\nargs = [{quoted_arguments}]\n",
            self.command()
        )
    }

    pub fn install_command(self, target_key: &str) -> String {
        let sendmock = match self {
            Self::Installed => "sendmock",
            Self::Npx => "npx sendmock",
        };
        format!("{sendmock} ai install --target {target_key}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-05.9
    #[test]
    fn npx_starts_the_published_package_without_asking() {
        assert_eq!(McpLaunch::Npx.command_line(), "npx -y sendmock mcp");
        assert_eq!(
            McpLaunch::Npx.stdio_server_entry(),
            json!({ "command": "npx", "args": ["-y", "sendmock", "mcp"] })
        );
        assert_eq!(
            McpLaunch::Npx.claude_code_command(),
            "claude mcp add sendmock -- npx -y sendmock mcp"
        );
        assert_eq!(
            McpLaunch::Npx.install_command("cursor"),
            "npx sendmock ai install --target cursor"
        );
    }

    // AC: AI-05.9
    #[test]
    fn the_codex_table_lists_each_argument() {
        assert_eq!(
            McpLaunch::Npx.codex_table(),
            "[mcp_servers.sendmock]\ncommand = \"npx\"\nargs = [\"-y\", \"sendmock\", \"mcp\"]\n"
        );
        assert_eq!(
            McpLaunch::Installed.codex_table(),
            "[mcp_servers.sendmock]\ncommand = \"sendmock\"\nargs = [\"mcp\"]\n"
        );
    }
}
