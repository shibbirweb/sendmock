#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

const FAILING_ASSERT_SCENARIO: &str = r#"name = "failing-assert"

[[steps]]
run = "sample.send"
with = { kind = "sms" }
save = "sample"

[[steps]]
run = "assert"
with = { that = "{{ sample.id }} == not-this-id" }

[[steps]]
run = "sms.get"
with = { smsId = "{{ sample.id }}" }
"#;

fn run_scenario_command(subcommand: &str, scenario_text: &str) -> (Option<i32>, serde_json::Value) {
    let working_directory = tempfile::tempdir()
        .unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"));
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let server_url = format!("http://{}", sendmock.wait_for_http_addr());
    std::fs::write(
        working_directory.path().join("flow.scenario.toml"),
        scenario_text,
    )
    .unwrap_or_else(|write_error| panic!("the scenario file is written: {write_error}"));

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "scenario",
        subcommand,
        "flow.scenario.toml",
        "--server",
        &server_url,
    ]))
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));

    let command_output = serde_json::from_slice(&output.stdout)
        .unwrap_or_else(|json_error| panic!("stdout is JSON: {json_error}"));
    (output.status.code(), command_output)
}

// AC: AI-04.1
#[test]
fn scenario_run_exits_five_at_the_first_failed_assert() {
    let (exit_code, scenario_report) = run_scenario_command("run", FAILING_ASSERT_SCENARIO);

    assert_eq!(exit_code, Some(5), "{scenario_report}");
    assert_eq!(scenario_report["is_passed"], false);
    assert_eq!(scenario_report["steps"][1]["status"], "failed");
    assert_eq!(scenario_report["steps"][2]["status"], "skipped");
}

// AC: AI-04.2
#[test]
fn scenario_validate_exits_five_for_an_unknown_step_and_zero_for_a_good_file() {
    let (bad_exit_code, validation) =
        run_scenario_command("validate", "[[steps]]\nrun = \"rocket.launch\"\n");
    let (good_exit_code, _) = run_scenario_command("validate", FAILING_ASSERT_SCENARIO);

    assert_eq!(bad_exit_code, Some(5), "{validation}");
    assert_eq!(validation["is_valid"], false);
    assert_eq!(good_exit_code, Some(0));
}
