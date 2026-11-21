#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const INBOX_SCENARIO: &str = "name = \"Inbox\"\n\n[[steps]]\nrun = \"email.list\"\nsave = \"inbox\"\n\n[[steps]]\nrun = \"assert\"\nwith = { that = \"1 > 0\" }\n";

async fn save_scenario(app_router: &axum::Router, scenario_input: &Value) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/scenarios",
        Some(scenario_input),
    )
    .await
}

// AC: AI-07.1
#[tokio::test]
async fn a_scenario_is_saved_listed_opened_edited_renamed_and_deleted() {
    let (app_router, _) = build_test_app();

    let (created_status, created) = save_scenario(
        &app_router,
        &json!({ "name": "Inbox", "description": "Checks the inbox", "scenario": INBOX_SCENARIO }),
    )
    .await;
    let scenario_id = created["id"].as_str().unwrap_or_default().to_owned();
    let (_, listed) = call_api(&app_router, "GET", "/api/v1/scenarios", None).await;
    let (_, opened) = call_api(&app_router, "GET", "/api/v1/scenarios/Inbox", None).await;
    let rename = json!({ "name": "Inbox check", "description": "Renamed" });
    let scenario_path = format!("/api/v1/scenarios/{scenario_id}");
    let (renamed_status, renamed) =
        call_api(&app_router, "PATCH", &scenario_path, Some(&rename)).await;
    let (deleted_status, _) = call_api(&app_router, "DELETE", &scenario_path, None).await;
    let (missing_status, _) = call_api(&app_router, "GET", &scenario_path, None).await;

    assert_eq!(created_status, 201, "{created}");
    assert_eq!(created["created_by"], "api");
    assert_eq!(listed.as_array().map(Vec::len), Some(1));
    assert_eq!(opened["id"], scenario_id.as_str());
    assert_eq!(opened["scenario"], INBOX_SCENARIO);
    assert_eq!(renamed_status, 200, "{renamed}");
    assert_eq!(renamed["name"], "Inbox check");
    assert_eq!(renamed["description"], "Renamed");
    assert_eq!(renamed["scenario"], INBOX_SCENARIO);
    assert_eq!(deleted_status, 204);
    assert_eq!(missing_status, 404);
}

// AC: AI-07.1
#[tokio::test]
async fn an_invalid_scenario_or_a_taken_name_is_refused() {
    let (app_router, _) = build_test_app();
    save_scenario(
        &app_router,
        &json!({ "name": "Inbox", "scenario": INBOX_SCENARIO }),
    )
    .await;

    let (invalid_status, invalid_answer) = save_scenario(
        &app_router,
        &json!({ "name": "Broken", "scenario": "name = \"Broken\"\n[[steps]]\nrun = \"rocket.launch\"\n" }),
    )
    .await;
    let (taken_status, taken_answer) = save_scenario(
        &app_router,
        &json!({ "name": "Inbox", "scenario": INBOX_SCENARIO }),
    )
    .await;

    assert_eq!(invalid_status, 422, "{invalid_answer}");
    assert_eq!(invalid_answer["error"]["code"], "invalid_scenario");
    assert!(
        invalid_answer["error"]["message"]
            .as_str()
            .is_some_and(|message| message.contains("step 1: Unknown operation rocket.launch.")),
        "{invalid_answer}"
    );
    assert_eq!(taken_status, 409, "{taken_answer}");
    assert_eq!(taken_answer["error"]["code"], "scenario_exists");
}

// AC: AI-07.2
#[tokio::test]
async fn a_saved_scenario_runs_by_id_or_name_with_the_same_report_as_its_file() {
    let (app_router, _) = build_test_app();
    let (_, created) = save_scenario(
        &app_router,
        &json!({ "name": "Inbox", "scenario": INBOX_SCENARIO }),
    )
    .await;
    let scenario_id = created["id"].as_str().unwrap_or_default();

    let (by_id_status, by_id_report) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/scenarios/{scenario_id}/run"),
        None,
    )
    .await;
    let (_, by_name_report) =
        call_api(&app_router, "POST", "/api/v1/scenarios/Inbox/run", None).await;
    let (_, file_report) = call_api(
        &app_router,
        "POST",
        "/api/v1/scenarios/run",
        Some(&json!({ "scenario": INBOX_SCENARIO })),
    )
    .await;

    assert_eq!(by_id_status, 200, "{by_id_report}");
    assert_eq!(by_id_report["is_passed"], true);
    assert_eq!(by_id_report["steps"].as_array().map(Vec::len), Some(2));
    assert_eq!(by_name_report["is_passed"], true);
    assert_eq!(file_report["is_passed"], by_id_report["is_passed"]);
    assert_eq!(
        file_report["steps"].as_array().map(Vec::len),
        by_id_report["steps"].as_array().map(Vec::len)
    );
}
