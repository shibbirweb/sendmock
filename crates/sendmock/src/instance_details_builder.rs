use std::net::SocketAddr;
use std::path::Path;

use sendmock_ops::{InstanceDetails, ReleaseChannel};

/// Docker creates `/.dockerenv` and Podman `/run/.containerenv` in every container.
const CONTAINER_MARKER_FILES: [&str; 2] = ["/.dockerenv", "/run/.containerenv"];

pub fn build_instance_details(
    bound_http_addr: SocketAddr,
    bound_smtp_addr: SocketAddr,
    bound_provider_addr: Option<SocketAddr>,
    started_at_unix_ms: i64,
) -> InstanceDetails {
    InstanceDetails {
        version: env!("CARGO_PKG_VERSION"),
        channel: current_release_channel(),
        started_at_unix_ms,
        http_address: bound_http_addr.to_string(),
        smtp_address: bound_smtp_addr.to_string(),
        provider_address: bound_provider_addr.map(|provider_addr| provider_addr.to_string()),
        is_container: CONTAINER_MARKER_FILES
            .iter()
            .any(|marker_file| Path::new(marker_file).exists()),
    }
}

/// The channel a release workflow builds for (`SENDMOCK_RELEASE_CHANNEL`), else `dev`.
pub fn current_release_channel() -> ReleaseChannel {
    ReleaseChannel::from_build_setting(option_env!("SENDMOCK_RELEASE_CHANNEL"))
}
