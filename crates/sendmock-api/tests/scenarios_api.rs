#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const RUN_PATH: &str = "/api/v1/scenarios/run";
const VALIDATE_PATH: &str = "/api/v1/scenarios/validate";

const SAVED_SUBJECT_SCENARIO: &str = r#"name = "saved-subject"

[[steps]]
run = "sample.send"
with = { kind = "sms" }
save = "sample"

[[steps]]
run = "sms.get"
with = { smsId = "{{ sample.id }}" }
save = "sms"

[[steps]]
run = "assert"
with = { that = "{{ sms.id }} == {{ sample.id }}" }

[[steps]]
run = "assert"
with = { that = "{{ sms.direction }} == nowhere" }

[[steps]]
run = "sms.get"
with = { smsId = "{{ sample.id }}" }
"#;

async fn post_scenario(app_router: &axum::Router, path: &str, scenario_text: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        path,
        Some(&json!({ "scenario": scenario_text })),
    )
    .await
}

fn read_step_statuses(scenario_report: &Value) -> Vec<&str> {
    scenario_report["steps"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|step_result| step_result["status"].as_str())
        .collect()
}

// AC: AI-04.1
#[tokio::test]
async fn steps_run_in_order_read_saved_results_and_stop_at_the_first_failed_assert() {
    let (app_router, _) = build_test_app();

    let (status, scenario_report) =
        post_scenario(&app_router, RUN_PATH, SAVED_SUBJECT_SCENARIO).await;

    assert_eq!(status, 200, "{scenario_report}");
    assert_eq!(scenario_report["name"], "saved-subject");
    assert_eq!(scenario_report["is_passed"], false);
    assert_eq!(
        read_step_statuses(&scenario_report),
        ["passed", "passed", "passed", "failed", "skipped"]
    );
    assert_eq!(
        scenario_report["steps"][1]["input"]["smsId"],
        scenario_report["steps"][0]["output"]["id"]
    );
    assert_eq!(scenario_report["steps"][1]["saved_as"], "sms");
    assert_eq!(
        scenario_report["steps"][3]["error"],
        format!(
            "Not true: {} == nowhere",
            scenario_report["steps"][1]["output"]["direction"]
                .as_str()
                .unwrap_or_default()
        )
    );
}

// AC: AI-04.1
#[tokio::test]
async fn a_failing_operation_step_reports_its_status_and_message() {
    let (app_router, _) = build_test_app();
    let missing_email_scenario =
        "[[steps]]\nrun = \"email.get\"\nwith = { emailId = \"01MISSING\" }\n";

    let (status, scenario_report) =
        post_scenario(&app_router, RUN_PATH, missing_email_scenario).await;

    assert_eq!(status, 200, "{scenario_report}");
    assert_eq!(scenario_report["is_passed"], false);
    let step_error = scenario_report["steps"][0]["error"]
        .as_str()
        .unwrap_or_default();
    assert!(step_error.starts_with("404: "), "{step_error}");
}

// AC: AI-04.2
#[tokio::test]
async fn validate_reports_unknown_steps_and_bad_files_without_running_anything() {
    let (app_router, _) = build_test_app();
    let unknown_step_scenario = "[[steps]]\nrun = \"sample.send\"\nwith = { kind = \"email\" }\n\n[[steps]]\nrun = \"email.nope\"\n\n[[steps]]\nwith = { a = 1 }\n";

    let (status, validation) =
        post_scenario(&app_router, VALIDATE_PATH, unknown_step_scenario).await;
    let (bad_toml_status, bad_toml_validation) =
        post_scenario(&app_router, VALIDATE_PATH, "[[steps]\n").await;
    let (_, emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;

    assert_eq!(status, 200, "{validation}");
    assert_eq!(validation["is_valid"], false);
    assert_eq!(validation["step_count"], 2);
    let problem_steps: Vec<&Value> = validation["problems"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|problem| &problem["step"])
        .collect();
    assert_eq!(problem_steps, [&json!(2), &json!(3)], "{validation}");
    assert_eq!(bad_toml_status, 200);
    assert_eq!(bad_toml_validation["is_valid"], false);
    assert_eq!(emails["total_count"], 0, "{emails}");
}

// AC: AI-04.2
#[tokio::test]
async fn running_a_file_with_problems_is_refused_before_any_step() {
    let (app_router, _) = build_test_app();

    let (status, refusal) =
        post_scenario(&app_router, RUN_PATH, "[[steps]]\nrun = \"email.nope\"\n").await;

    assert_eq!(status, 400, "{refusal}");
}
