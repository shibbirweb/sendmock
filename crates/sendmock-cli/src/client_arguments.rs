use clap::Args;

/// Flags every client command takes.
#[derive(Debug, Clone, Default, Args)]
pub struct ClientArguments {
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

    /// Print JSON (the default when the output is not a terminal)
    #[arg(long)]
    pub json: bool,
}
