use crate::config::ServerConfig;
use crate::listener_binding::bind_listener;
use crate::shutdown_signal::wait_for_shutdown_signal;
use crate::startup_error::StartupError;

pub async fn run_server(server_config: &ServerConfig) -> Result<(), StartupError> {
    let http_listener = bind_listener(server_config.http_addr, "--http-addr").await?;
    let http_addr = http_listener
        .local_addr()
        .map_err(|source| StartupError::Listen {
            address: server_config.http_addr,
            source,
        })?;
    tracing::info!(
        http_addr = %http_addr,
        database = %server_config.database_location,
        config_file = ?server_config.config_file_path,
        "SendMock is ready"
    );
    wait_for_shutdown_signal().await;
    tracing::info!("SendMock stopped");
    Ok(())
}
