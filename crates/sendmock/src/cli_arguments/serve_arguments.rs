use std::net::SocketAddr;
use std::path::PathBuf;

use clap::Args;

use crate::config::{LogFormat, LogLevel};

/// Flags for running the server. Each one can also come from its `SENDMOCK_*` variable;
/// a flag wins over the variable, and both win over `sendmock.toml`.
#[derive(Debug, Clone, Default, Args)]
pub struct ServeArguments {
    /// Configuration file [default: ./sendmock.toml, then sendmock/sendmock.toml in the OS config folder]
    #[arg(long = "config", env = "SENDMOCK_CONFIG", value_name = "FILE")]
    pub config_file_path: Option<PathBuf>,

    /// Address for the web UI, REST API and MCP [default: 127.0.0.1:8025]
    #[arg(long, env = "SENDMOCK_HTTP_ADDR", value_name = "HOST:PORT")]
    pub http_addr: Option<SocketAddr>,

    /// Address for the SMTP listener [default: 127.0.0.1:1025]
    #[arg(long, env = "SENDMOCK_SMTP_ADDR", value_name = "HOST:PORT")]
    pub smtp_addr: Option<SocketAddr>,

    /// Database file, or `memory` to keep nothing after exit [default: sendmock.db in the OS data folder]
    #[arg(long = "db", env = "SENDMOCK_DB", value_name = "PATH|memory")]
    pub database_setting: Option<String>,

    /// Log output: readable lines, or one JSON object per line for log collectors [default: human]
    #[arg(long, env = "SENDMOCK_LOG_FORMAT", value_enum)]
    pub log_format: Option<LogFormat>,

    /// Lowest log level shown [default: info]
    #[arg(long, env = "SENDMOCK_LOG_LEVEL", value_enum)]
    pub log_level: Option<LogLevel>,

    /// Seed file with the configuration to start from [default: ./sendmock.seed.toml when present]
    #[arg(long = "seed", env = "SENDMOCK_SEED", value_name = "FILE")]
    pub seed_file_path: Option<PathBuf>,
}
