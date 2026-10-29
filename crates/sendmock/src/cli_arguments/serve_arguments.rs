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

    /// Address for the SMTPS listener (TLS from the first byte); off unless set
    #[arg(long, env = "SENDMOCK_SMTPS_ADDR", value_name = "HOST:PORT")]
    pub smtps_addr: Option<SocketAddr>,

    /// Largest message SMTP accepts; larger ones get 552 [default: 25MB]
    #[arg(long, env = "SENDMOCK_SMTP_MAX_SIZE", value_name = "SIZE")]
    pub smtp_max_size: Option<String>,

    /// SMTP AUTH: `accept-any`, `none` (not offered) or `file:<path>` with `user:password` lines [default: accept-any]
    #[arg(long, env = "SENDMOCK_SMTP_AUTH", value_name = "MODE")]
    pub smtp_auth: Option<String>,

    /// Certificate (PEM) for STARTTLS and SMTPS [default: a self-signed one generated on first run]
    #[arg(
        long,
        env = "SENDMOCK_SMTP_TLS_CERT",
        value_name = "FILE",
        requires = "smtp_tls_key"
    )]
    pub smtp_tls_cert: Option<PathBuf>,

    /// Private key (PEM) for `--smtp-tls-cert`
    #[arg(
        long,
        env = "SENDMOCK_SMTP_TLS_KEY",
        value_name = "FILE",
        requires = "smtp_tls_cert"
    )]
    pub smtp_tls_key: Option<PathBuf>,

    /// Refuse MAIL with 530 until the client has run STARTTLS
    #[arg(long, env = "SENDMOCK_SMTP_REQUIRE_TLS")]
    pub smtp_require_tls: bool,

    /// Recipients SMTP accepts, as comma-separated globs; others get 550 [default: *]
    #[arg(long, env = "SENDMOCK_SMTP_ALLOW_RCPT", value_name = "GLOBS")]
    pub smtp_allow_rcpt: Option<String>,

    /// The most emails kept; older ones (and older SMTP and API log entries) are pruned [default: 1000]
    #[arg(long, env = "SENDMOCK_MAX_EMAILS", value_name = "COUNT")]
    pub max_emails: Option<u64>,

    /// Prune traffic older than this, such as 7d [default: keep until the count limit]
    #[arg(long, env = "SENDMOCK_MAX_AGE", value_name = "DAYS")]
    pub max_age: Option<String>,

    /// When to look for a newer release: off, manual or daily [default: off]
    #[arg(long, env = "SENDMOCK_UPDATE_CHECK", value_name = "MODE")]
    pub update_check: Option<String>,

    /// Print one JSON line with the bound addresses on stdout once listening (logs go to stderr); port 0 picks a free port
    #[arg(long, env = "SENDMOCK_READY_JSON")]
    pub ready_json: bool,

    /// Protect the UI, API, realtime streams and MCP over HTTP: `user:password`, or `file:<path>` with `user:password` lines
    #[arg(
        long,
        env = "SENDMOCK_UI_AUTH",
        hide_env_values = true,
        value_name = "USER:PASSWORD|file:PATH"
    )]
    pub ui_auth: Option<String>,

    /// With --ui-auth, also accept `Authorization: Bearer <token>` (for the CLI, scripts and the docs playground)
    #[arg(
        long,
        env = "SENDMOCK_API_TOKEN",
        hide_env_values = true,
        value_name = "TOKEN"
    )]
    pub api_token: Option<String>,

    /// Browser origins allowed to call the API, comma-separated; empty turns CORS off [default: https://shibbirweb.github.io]
    #[arg(long, env = "SENDMOCK_CORS_ORIGINS", value_name = "ORIGINS")]
    pub cors_origins: Option<String>,

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
