use std::process::ExitCode;

use serde_json::json;

use crate::instance_details_builder::current_release_channel;

/// Answers from the binary itself, so it works without a running server.
pub fn print_version(as_json: bool) -> ExitCode {
    let version = env!("CARGO_PKG_VERSION");
    let channel = current_release_channel();
    if as_json {
        println!("{}", json!({ "version": version, "channel": channel }));
    } else {
        let channel_name = serde_json::to_value(channel)
            .ok()
            .and_then(|channel_value| channel_value.as_str().map(str::to_owned))
            .unwrap_or_default();
        println!("sendmock {version} ({channel_name})");
    }
    ExitCode::SUCCESS
}
