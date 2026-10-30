use schemars::JsonSchema;
use serde::Deserialize;

use super::integration_snippet::{
    IntegrationSnippet, SnippetTarget, build_catcher_snippet, build_smtp_snippet, find_app_host,
    find_snippet_language,
};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

#[derive(Debug, Deserialize, JsonSchema)]
pub struct IntegrationRequest {
    /// Your app's stack: a language (`laravel`, `node`, `python`, `go`, `java`, `ruby`, `dotnet`, `curl`) or a framework (`php`, `express`, `nestjs`, `django`, `flask`, `fastapi`, `spring`, `rails`, `aspnet`).
    pub stack: String,
    /// email, sms or http (default email).
    pub channel: Option<String>,
    /// Where the app runs: local, docker-host or compose.
    pub host: Option<String>,
}

pub struct GetIntegrationOperation;

impl Operation for GetIntegrationOperation {
    type Input = IntegrationRequest;
    type Output = IntegrationSnippet;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getIntegrationsByStack",
            method: HttpMethod::Get,
            path: "/api/v1/integrations/{stack}",
            summary: "Copy-ready settings for a stack, as Settings > Connection shows them.",
            is_read_only: true,
            cli_usage: "sendmock integrate <stack>",
            mcp_tool: "sendmock_integration_snippet",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Uses the ports this instance listens on; SMS snippets come with the SMS API.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: IntegrationRequest,
    ) -> Result<IntegrationSnippet, OperationError> {
        let language =
            find_snippet_language(&input.stack).ok_or_else(|| OperationError::NotFound {
                message: format!("No snippets for the stack {}", input.stack),
            })?;
        let instance_details = &operation_context.instance_details;
        let target = SnippetTarget {
            host: find_app_host(input.host.as_deref()).to_owned(),
            smtp_port: read_port(&instance_details.smtp_address, 1025),
            http_port: read_port(&instance_details.http_address, 8025),
        };
        let channel = input.channel.unwrap_or_else(|| "email".to_owned());
        let code = match channel.as_str() {
            "email" => build_smtp_snippet(language, &target),
            "http" => build_catcher_snippet(&target),
            other_channel => {
                return Err(OperationError::NotFound {
                    message: format!("No {other_channel} snippets in this version yet"),
                });
            }
        };
        Ok(IntegrationSnippet {
            stack: input.stack.to_lowercase(),
            channel,
            host: target.host,
            language: language.to_owned(),
            code,
        })
    }
}

/// The port of a `host:port` address, or the default when it has none.
fn read_port(listen_address: &str, default_port: u16) -> u16 {
    listen_address
        .rsplit_once(':')
        .and_then(|(_, port_text)| port_text.parse().ok())
        .unwrap_or(default_port)
}
