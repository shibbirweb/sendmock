/// The header the CLI, the MCP server and the UI name themselves in, so items record who made
/// them (AI-05.4).
pub const REQUEST_CLIENT_HEADER: &str = "x-sendmock-client";

/// Who asked: the UI, a plain API call, the CLI or an agent through MCP.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum RequestClient {
    Ui,
    #[default]
    Api,
    Cli,
    Mcp,
}

impl RequestClient {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ui => "ui",
            Self::Api => "api",
            Self::Cli => "cli",
            Self::Mcp => "mcp",
        }
    }

    /// The header's value; anything else is a plain API call.
    pub fn from_header_value(header_value: &str) -> Self {
        match header_value.trim().to_ascii_lowercase().as_str() {
            "ui" => Self::Ui,
            "cli" => Self::Cli,
            "mcp" => Self::Mcp,
            _ => Self::Api,
        }
    }
}
