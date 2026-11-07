#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::path::Path;

use serde_json::{Value, json};
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

fn start_server(working_directory: &Path) -> (SendmockProcess, String) {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let http_addr = sendmock.wait_for_http_addr();
    (sendmock, http_addr)
}

/// Runs a command with `--json` that must succeed and answers its output.
fn run_json_command(working_directory: &Path, http_addr: &str, arguments: &[&str]) -> Value {
    let server_url = format!("http://{http_addr}");
    let output = run_until_exit(sendmock_command(working_directory).args(arguments).args([
        "--json",
        "--server",
        &server_url,
    ]))
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));
    assert_eq!(
        output.status.code(),
        Some(0),
        "{arguments:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).unwrap_or_else(|parse_error| {
        panic!(
            "stdout is JSON ({parse_error}): {}",
            String::from_utf8_lossy(&output.stdout)
        )
    })
}

fn read_text(json_value: &Value) -> String {
    json_value.as_str().unwrap_or_default().to_owned()
}

/// Points the Stripe gateway's notifications at a new endpoint, so a payment has one to resend.
fn notify_an_endpoint(run: &dyn Fn(&[&str]) -> Value) {
    let endpoint = json!({
        "name": "Shop payments", "url": "http://127.0.0.1:9/hooks", "method": "POST",
        "headers": {}, "extra_fields": {}, "template_id": "native", "template_mode": "linked",
        "timeout_ms": 1000,
        "retry_policy": { "max_attempts": 1, "backoff_seconds": [1], "retry_on_client_errors": false },
        "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
        "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
        "render_mode": "strict",
    });
    let created_endpoint = run(&[
        "webhook",
        "endpoint",
        "create",
        "--data",
        &endpoint.to_string(),
    ]);
    let mut stripe_gateway = run(&["payments", "gateways", "show", "stripe"]);
    stripe_gateway["notification_endpoint_id"] = created_endpoint["id"].clone();
    run(&[
        "payments",
        "gateways",
        "update",
        "stripe",
        "--data",
        &stripe_gateway.to_string(),
    ]);
}

// AC: PY-11.1
#[test]
fn a_checkout_is_listed_shown_simulated_notified_and_waited_for_from_the_cli() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let run =
        |arguments: &[&str]| run_json_command(working_directory.path(), &http_addr, arguments);
    notify_an_endpoint(&run);

    let checkout = run(&[
        "payments",
        "checkout",
        "create",
        "--provider",
        "stripe",
        "--amount-minor",
        "1999",
        "--currency",
        "USD",
    ]);
    let payment_id = read_text(&checkout["id"]);
    let waiting = run(&["payments", "list", "--status", "requires_payment"]);
    let paid = run(&["payments", "simulate", &payment_id, "succeed"]);
    let waited = run(&[
        "payments",
        "wait",
        "--provider",
        "stripe",
        "--status",
        "succeeded",
        "--timeout",
        "5s",
    ]);
    let shown = run(&["payments", "show", &payment_id]);
    let notified = run(&["payments", "notify", &payment_id]);
    let test_cards = run(&["payments", "test-cards"]);

    assert_eq!(waiting["items"][0]["id"], payment_id.as_str());
    assert_eq!(paid["status"], "succeeded");
    assert_eq!(waited["id"], payment_id.as_str());
    assert_eq!(shown["amount_minor"], 1999);
    assert!(
        shown["notifications"]
            .as_array()
            .is_some_and(|notifications| !notifications.is_empty())
    );
    assert_eq!(notified["id"], payment_id.as_str());
    assert!(
        test_cards.to_string().contains("4242424242424242"),
        "{test_cards}"
    );
}
