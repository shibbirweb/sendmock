#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::time::{Duration, Instant};

use serde_json::Value;
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

/// A running binary and the CLI pointed at it; webhooks go to its own catcher.
struct CliSession {
    working_directory: tempfile::TempDir,
    server_url: String,
    _sendmock: SendmockProcess,
}

impl CliSession {
    fn start() -> Self {
        let working_directory = tempfile::tempdir()
            .unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"));
        let sendmock = SendmockProcess::start_with_free_port(working_directory.path())
            .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
        let server_url = format!("http://{}", sendmock.wait_for_http_addr());
        Self {
            working_directory,
            server_url,
            _sendmock: sendmock,
        }
    }

    /// Runs one command and answers its JSON output; the command must succeed.
    fn run_json(&self, arguments: &[&str]) -> Value {
        let output = run_until_exit(
            sendmock_command(self.working_directory.path())
                .args(arguments)
                .args(["--server", &self.server_url]),
        )
        .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));
        assert_eq!(
            output.status.code(),
            Some(0),
            "{arguments:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).unwrap_or(Value::Null)
    }

    fn catch_url(&self, bin_path: &str) -> String {
        format!("{}/catch/{bin_path}", self.server_url)
    }

    /// The bodies the catcher received, oldest first, once there are `expected_count`.
    fn wait_for_caught_bodies(&self, expected_count: usize) -> Vec<String> {
        let deadline = Instant::now() + Duration::from_secs(20);
        loop {
            let caught_requests = self.run_json(&["http", "list"]);
            let mut caught_bodies: Vec<String> = caught_requests["items"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|caught_request| {
                    caught_request["body"]
                        .as_str()
                        .unwrap_or_default()
                        .to_owned()
                })
                .collect();
            if caught_bodies.len() >= expected_count || Instant::now() > deadline {
                caught_bodies.reverse();
                return caught_bodies;
            }
            std::thread::sleep(Duration::from_millis(200));
        }
    }
}

fn read_id(created: &Value) -> String {
    created["id"].as_str().unwrap_or_default().to_owned()
}

/// `webhook endpoint create` with every field the command requires: a native JSON body,
/// or the raw body given.
fn endpoint_create_arguments(
    endpoint_name: &str,
    endpoint_url: &str,
    raw_body: Option<&str>,
) -> Vec<String> {
    let body_mode = if raw_body.is_some() {
        "raw"
    } else {
        "template"
    };
    [
        "webhook",
        "endpoint",
        "create",
        "--name",
        endpoint_name,
        "--url",
        endpoint_url,
        "--method",
        "POST",
        "--headers",
        "{}",
        "--extra-fields",
        "{}",
        "--query-params",
        "[]",
        "--template-id",
        "native",
        "--template-mode",
        "linked",
        "--timeout-ms",
        "10000",
        "--retry-policy",
        r#"{"max_attempts":1,"backoff_seconds":[1],"retry_on_client_errors":false}"#,
        "--body-mode",
        body_mode,
        "--body-fields",
        "[]",
        "--fields-encoding",
        "json",
        "--raw-content-type",
        "application/json",
        "--raw-body",
        raw_body.unwrap_or_default(),
        "--render-mode",
        "strict",
        "--enabled",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

fn as_arguments(owned_arguments: &[String]) -> Vec<&str> {
    owned_arguments.iter().map(String::as_str).collect()
}

// AC: WH-01.1
#[test]
fn endpoints_are_created_switched_off_and_deleted_with_the_cli() {
    let session = CliSession::start();
    let endpoint_url = session.catch_url("cli-orders");

    let created = session.run_json(&as_arguments(&endpoint_create_arguments(
        "Orders app",
        &endpoint_url,
        None,
    )));
    let endpoint_id = read_id(&created);
    let switched_off = session.run_json(&[
        "webhook",
        "endpoint",
        "update",
        &endpoint_id,
        "--no-enabled",
    ]);
    let listed = session.run_json(&["webhook", "endpoint", "list"]);
    session.run_json(&["webhook", "endpoint", "delete", &endpoint_id, "--yes"]);
    let listed_after_delete = session.run_json(&["webhook", "endpoint", "list"]);

    assert_eq!(created["name"], "Orders app");
    assert_eq!(created["is_enabled"], true);
    assert_eq!(switched_off["is_enabled"], false);
    assert_eq!(listed.as_array().map(Vec::len), Some(1), "{listed}");
    assert_eq!(
        listed_after_delete.as_array().map(Vec::len),
        Some(0),
        "{listed_after_delete}"
    );
}

// AC: WH-05.4
#[test]
fn webhook_send_takes_variables_that_win_for_that_send_only() {
    let session = CliSession::start();
    session.run_json(&[
        "webhook",
        "var",
        "set",
        "greeting",
        "hello",
        "--kind",
        "text",
        "--scope",
        "global",
        "--description",
        "Greeting",
    ]);
    let endpoint_url = session.catch_url("cli-greetings");
    let endpoint_id = read_id(&session.run_json(&as_arguments(&endpoint_create_arguments(
        "Greetings",
        &endpoint_url,
        Some(r#"{"greeting": "{{ vars.greeting }}"}"#),
    ))));

    session.run_json(&[
        "webhook",
        "send",
        "--endpoint",
        &endpoint_id,
        "--variables",
        r#"{"greeting": "hi there"}"#,
    ]);
    session.wait_for_caught_bodies(1);
    session.run_json(&["webhook", "send", "--endpoint", &endpoint_id]);
    let caught_bodies = session.wait_for_caught_bodies(2);

    assert_eq!(
        caught_bodies,
        vec![r#"{"greeting": "hi there"}"#, r#"{"greeting": "hello"}"#]
    );
}

// AC: PL-03.5
#[test]
fn a_sample_email_fires_the_same_webhook_rule_as_real_mail() {
    let session = CliSession::start();
    let endpoint_url = session.catch_url("cli-samples");
    let endpoint_id = read_id(&session.run_json(&as_arguments(&endpoint_create_arguments(
        "Mail app",
        &endpoint_url,
        None,
    ))));
    session.run_json(&[
        "webhook",
        "rule",
        "create",
        "--name",
        "All mail",
        "--endpoint-id",
        &endpoint_id,
        "--event",
        "email.received",
        "--enabled",
    ]);

    let sample_email = session.run_json(&[
        "sample",
        "email",
        "--to",
        "sam@example.test",
        "--subject",
        "Sample order",
    ]);
    let caught_bodies = session.wait_for_caught_bodies(1);

    assert!(sample_email["id"].is_string(), "{sample_email}");
    assert_eq!(caught_bodies.len(), 1);
    assert!(
        caught_bodies[0].contains("email.received"),
        "{}",
        caught_bodies[0]
    );
    assert!(
        caught_bodies[0].contains("Sample order"),
        "{}",
        caught_bodies[0]
    );
}
