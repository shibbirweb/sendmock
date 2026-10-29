use clap::Args;

/// Flags for `sendmock mcp`.
#[derive(Debug, Clone, Default, Args)]
pub struct McpArguments {
    /// Toolsets to expose, comma-separated, or `all` [default: core,email,sms,verify,extract,webhooks]
    #[arg(long, env = "SENDMOCK_MCP_TOOLSETS", value_name = "LIST")]
    pub toolsets: Option<String>,

    /// Expose only the tools that read
    #[arg(long)]
    pub read_only: bool,

    /// The SendMock to talk to [default: from SENDMOCK_HTTP_ADDR, else http://127.0.0.1:8025]
    #[arg(long, env = "SENDMOCK_SERVER", value_name = "URL")]
    pub server: Option<String>,

    /// API token, when the server has UI auth on
    #[arg(
        long,
        env = "SENDMOCK_TOKEN",
        hide_env_values = true,
        value_name = "TOKEN"
    )]
    pub token: Option<String>,
}
