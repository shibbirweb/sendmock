use std::net::SocketAddr;
use std::path::Path;

use sendmock_ops::{InstanceDetails, ReleaseChannel};

use crate::config::ServerConfig;

/// Docker creates `/.dockerenv` and Podman `/run/.containerenv` in every container.
const CONTAINER_MARKER_FILES: [&str; 2] = ["/.dockerenv", "/run/.containerenv"];

pub fn build_instance_details(
    server_config: &ServerConfig,
    bound_http_addr: SocketAddr,
    started_at_unix_ms: i64,
) -> InstanceDetails {
    InstanceDetails {
        version: env!("CARGO_PKG_VERSION"),
        channel: ReleaseChannel::from_build_setting(option_env!("SENDMOCK_RELEASE_CHANNEL")),
        started_at_unix_ms,
        http_address: bound_http_addr.to_string(),
        smtp_address: server_config.smtp_addr.to_string(),
        provider_address: None,
        is_container: CONTAINER_MARKER_FILES
            .iter()
            .any(|marker_file| Path::new(marker_file).exists()),
    }
}
