use std::process::ExitCode;
use std::sync::Arc;

use sendmock_cli::{ApiAnswer, ApiClient, CliExitCode, resolve_server_url};
use sendmock_mcp::{
    McpToolCatalog, OperationRunner, RunFuture, SendmockMcpServer, ToolFilter, serve_mcp_over_stdio,
};
use sendmock_ops::{
    AnswerKind, ErasedOperation, FileAnswer, OperationAnswer, build_operation_registry,
};
use serde_json::Value;

use crate::cli_arguments::McpArguments;
use crate::embedded_server::EmbeddedServer;

/// Runs tool calls as REST calls to a running SendMock, as the CLI does.
struct RemoteOperationRunner {
    api_client: ApiClient,
}

impl OperationRunner for RemoteOperationRunner {
    fn run_operation(&self, operation: Arc<dyn ErasedOperation>, input: Value) -> RunFuture<'_> {
        Box::pin(async move {
            let definition = operation.definition();
            let api_answer = self
                .api_client
                .call_operation(definition, &input)
                .await
                .map_err(|cli_error| cli_error.to_string())?;
            Ok(match api_answer {
                ApiAnswer::Json(json_answer) => OperationAnswer::Json(json_answer),
                ApiAnswer::File(file_bytes) => OperationAnswer::File(FileAnswer {
                    content_type: match definition.answer_kind {
                        AnswerKind::File { content_type } => content_type.to_owned(),
                        AnswerKind::Json => "application/octet-stream".to_owned(),
                    },
                    file_name: None,
                    bytes: file_bytes,
                }),
                ApiAnswer::Empty => OperationAnswer::Empty,
            })
        })
    }
}

/// `sendmock mcp`: an MCP server on stdin and stdout whose tools call the SendMock at
/// `--server`, started in this process first with `--embedded` when none answers there.
/// Nothing but protocol messages goes to stdout.
pub fn run_mcp_command(mcp_arguments: &McpArguments) -> ExitCode {
    let server_url = resolve_server_url(
        mcp_arguments.server.as_deref(),
        std::env::var("SENDMOCK_HTTP_ADDR").ok().as_deref(),
    );
    let operation_runner = RemoteOperationRunner {
        api_client: ApiClient::new(server_url.clone(), mcp_arguments.token.clone()).for_mcp(),
    };
    let tool_catalog = McpToolCatalog::new(
        &build_operation_registry(),
        &ToolFilter::from_settings(mcp_arguments.toolsets.as_deref(), mcp_arguments.read_only),
        Arc::new(operation_runner),
    );
    let mcp_server = SendmockMcpServer::new(tool_catalog, env!("CARGO_PKG_VERSION"));
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(runtime_error) => {
            eprintln!("Could not start the MCP runtime: {runtime_error}");
            return CliExitCode::Error.into();
        }
    };
    let served = runtime.block_on(async {
        let embedded_server = if mcp_arguments.embedded {
            EmbeddedServer::start_unless_running(&server_url)
                .await
                .map_err(|embedded_error| embedded_error.to_string())?
        } else {
            None
        };
        serve_until_stopped(mcp_server, embedded_server).await
    });
    match served {
        Ok(()) => CliExitCode::Success.into(),
        Err(serve_error) => {
            eprintln!("The MCP server stopped: {serve_error}");
            CliExitCode::Error.into()
        }
    }
}

/// Serves MCP until stdin closes, or until the embedded server stops on a signal, since
/// its signal handling replaces the default exit.
async fn serve_until_stopped(
    mcp_server: SendmockMcpServer,
    embedded_server: Option<EmbeddedServer>,
) -> Result<(), String> {
    let Some(embedded_server) = embedded_server else {
        return serve_mcp_over_stdio(mcp_server).await;
    };
    tokio::select! {
        served = serve_mcp_over_stdio(mcp_server) => served,
        () = embedded_server.wait_until_stopped() => Ok(()),
    }
}
