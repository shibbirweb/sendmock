#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::path::Path;
use std::process::Output;

use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

const APP_NUMBER: &str = "+15550001111";
const CONTACT_NUMBER: &str = "+8801700000000";

fn start_server(working_directory: &Path) -> (SendmockProcess, String) {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let http_addr = sendmock.wait_for_http_addr();
    (sendmock, http_addr)
}

fn run_command(working_directory: &Path, http_addr: &str, arguments: &[&str]) -> Output {
    let server_url = format!("http://{http_addr}");
    run_until_exit(
        sendmock_command(working_directory)
            .args(arguments)
            .args(["--server", &server_url]),
    )
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"))
}

/// Runs a command that must succeed and answers its JSON output.
fn run_json_command(
    working_directory: &Path,
    http_addr: &str,
    arguments: &[&str],
) -> serde_json::Value {
    let output = run_command(working_directory, http_addr, arguments);
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

#[test]
fn an_sms_sent_from_the_cli_is_waited_for_threaded_and_gives_its_code() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let run =
        |arguments: &[&str]| run_json_command(working_directory.path(), &http_addr, arguments);

    let sent_sms = run(&[
        "sms",
        "send",
        "--from",
        APP_NUMBER,
        "--to",
        CONTACT_NUMBER,
        "--body",
        "Your code is 482913",
    ]);
    let waited_sms = run(&["sms", "wait", "--to", CONTACT_NUMBER, "--timeout", "5s"]);
    let threads = run(&["sms", "threads"]);
    let otp = run(&["otp", "--to", CONTACT_NUMBER, "--channel", "sms"]);

    assert_eq!(waited_sms["id"], sent_sms["id"]);
    assert_eq!(sent_sms["encoding"], "GSM-7");
    assert_eq!(sent_sms["segments"], 1);
    assert_eq!(threads[0]["contact_number"], CONTACT_NUMBER);
    assert_eq!(threads[0]["last_message"]["id"], sent_sms["id"]);
    assert_eq!(otp["code"], "482913");
}

#[test]
fn waiting_for_an_sms_that_never_comes_exits_with_the_timeout_code() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());

    let output = run_command(
        working_directory.path(),
        &http_addr,
        &["sms", "wait", "--to", CONTACT_NUMBER, "--timeout", "500ms"],
    );

    assert_eq!(output.status.code(), Some(4));
}

#[test]
fn numbers_and_messaging_services_are_managed_from_the_cli() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let run =
        |arguments: &[&str]| run_json_command(working_directory.path(), &http_addr, arguments);

    let virtual_number = run(&[
        "numbers",
        "add",
        "--number",
        APP_NUMBER,
        "--label",
        "Support line",
        "--channel",
        "sms",
    ]);
    let number_id = virtual_number["id"].as_str().unwrap_or_default().to_owned();
    let messaging_service = run(&[
        "sms",
        "services",
        "create",
        "--friendly-name",
        "Notifications",
        "--number-id",
        &number_id,
    ]);
    let numbers = run(&["numbers", "list"]);
    let services = run(&["sms", "services", "list"]);

    assert_eq!(numbers[0]["number"], APP_NUMBER);
    assert_eq!(
        numbers[0]["messaging_service_sid"],
        messaging_service["sid"]
    );
    assert_eq!(services[0]["friendly_name"], "Notifications");
    assert_eq!(services[0]["number_ids"][0], number_id.as_str());
}

#[test]
fn a_custom_outcome_number_from_the_cli_decides_the_outcome() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let run =
        |arguments: &[&str]| run_json_command(working_directory.path(), &http_addr, arguments);

    let outcome_rule = run(&[
        "outcome-rule",
        "sms",
        "create",
        "--match-field",
        "to",
        "--pattern",
        "+1555777*",
        "--outcome",
        "undelivered",
        "--error-code",
        "30003",
        "--note",
        "Unreachable handset",
        "--enabled",
    ]);
    let custom_result = run(&[
        "outcome-rule",
        "sms",
        "test",
        "+15557770001",
        "--match-field",
        "to",
    ]);
    let magic_result = run(&[
        "outcome-rule",
        "sms",
        "test",
        "+15005550001",
        "--match-field",
        "to",
    ]);

    assert_eq!(custom_result["source"], "custom");
    assert_eq!(custom_result["rule_id"], outcome_rule["id"]);
    assert_eq!(magic_result["source"], "magic");
}

// AC: VF-04.1
#[test]
fn a_verification_started_from_the_cli_can_be_shown_and_forced() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let run =
        |arguments: &[&str]| run_json_command(working_directory.path(), &http_addr, arguments);

    run(&[
        "verify",
        "services",
        "create",
        "--friendly-name",
        "Shop",
        "--fixed-code",
        "123456",
    ]);
    let sample = run(&["sample", "verification", "--to", CONTACT_NUMBER]);
    let verification_sid = sample["id"].as_str().unwrap_or_default().to_owned();
    let started = run(&["verify", "show", &verification_sid]);
    let forced = run(&["verify", "force", &verification_sid, "approved"]);
    let approved_list = run(&["verify", "list", "--status", "approved"]);

    assert_eq!(started["status"], "pending");
    assert_eq!(started["code"], "123456");
    assert_eq!(started["service_name"], "Shop");
    assert_eq!(forced["status"], "approved");
    assert_eq!(approved_list["items"][0]["sid"], verification_sid.as_str());
}

#[test]
fn an_sms_provider_secret_is_masked_unless_revealed() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let run =
        |arguments: &[&str]| run_json_command(working_directory.path(), &http_addr, arguments);

    let providers = run(&["sms", "providers", "list"]);
    let twilio = run(&["sms", "providers", "show", "twilio"]);
    let masked = run(&["sms", "providers", "credential", "twilio", "auth_token"]);
    let revealed = run(&[
        "sms",
        "providers",
        "credential",
        "twilio",
        "auth_token",
        "--reveal",
    ]);

    assert!(providers.to_string().contains("\"vonage\""), "{providers}");
    assert!(
        !twilio.to_string().contains("twilio-test-token"),
        "{twilio}"
    );
    assert_eq!(masked["value"], "••••oken");
    assert_eq!(revealed["value"], "twilio-test-token");
}
