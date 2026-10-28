use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, Response};
use schemars::JsonSchema;
use sendmock_core::FixedClock;
use sendmock_ops::{
    HttpMethod, InstanceDetails, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, OperationRegistry, ReleaseChannel,
};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const SLOW_OPERATION_DURATION: Duration = Duration::from_millis(300);

pub fn build_test_operation_context() -> OperationContext {
    OperationContext {
        database: Arc::new(
            Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
                .expect("an in-memory database opens"),
        ),
        clock: Arc::new(FixedClock::new(1_767_225_600_000)),
        instance_details: Arc::new(InstanceDetails {
            version: "0.1.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 1_767_225_600_000,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            is_container: false,
        }),
    }
}

/// The real operations plus two fakes that exercise request bodies and slow answers.
pub fn build_test_operation_registry() -> OperationRegistry {
    let mut operation_registry = sendmock_ops::build_operation_registry();
    operation_registry.register(EchoOperation);
    operation_registry.register(SlowOperation);
    operation_registry
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct EchoMessage {
    pub text: String,
}

pub struct EchoOperation;

impl Operation for EchoOperation {
    type Input = EchoMessage;
    type Output = EchoMessage;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "testEcho",
            method: HttpMethod::Post,
            path: "/api/v1/test/echo",
            summary: "Answers with the text it was sent.",
            is_read_only: true,
            cli_usage: "sendmock test echo",
            mcp_tool: "sendmock_test_echo",
            selector: None,
            cli_arguments: &[],
            success_flag_field: None,
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        input: EchoMessage,
    ) -> Result<EchoMessage, OperationError> {
        Ok(input)
    }
}

pub struct SlowOperation;

impl Operation for SlowOperation {
    type Input = NoInput;
    type Output = EchoMessage;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "testSlow",
            method: HttpMethod::Get,
            path: "/api/v1/test/slow",
            summary: "Answers after a short wait.",
            is_read_only: true,
            cli_usage: "sendmock test slow",
            mcp_tool: "sendmock_test_slow",
            selector: None,
            cli_arguments: &[],
            success_flag_field: None,
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<EchoMessage, OperationError> {
        tokio::time::sleep(SLOW_OPERATION_DURATION).await;
        Ok(EchoMessage {
            text: "finished".to_owned(),
        })
    }
}

pub async fn read_json_body(response: Response<Body>) -> Value {
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("the body is readable");
    serde_json::from_slice(&body_bytes).expect("the body is JSON")
}

pub fn build_request(method: &str, uri: &str, body: &'static str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(body))
        .expect("a valid request")
}
