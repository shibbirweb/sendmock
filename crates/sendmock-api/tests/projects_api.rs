#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

async fn create_project(app_router: &axum::Router, project_key: &str, name: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/projects",
        Some(&json!({ "key": project_key, "name": name })),
    )
    .await
}

async fn list_project_keys(app_router: &axum::Router) -> Vec<String> {
    let (status, projects) = call_api(app_router, "GET", "/api/v1/projects", None).await;
    assert_eq!(status, 200, "{projects}");
    projects
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|project| project["key"].as_str().map(str::to_owned))
        .collect()
}

// AC: PL-10.1
#[tokio::test]
async fn a_fresh_instance_has_only_the_default_project() {
    let (app_router, _) = build_test_app();

    let (status, projects) = call_api(&app_router, "GET", "/api/v1/projects", None).await;

    assert_eq!(status, 200);
    assert_eq!(projects[0]["key"], "default");
    assert_eq!(projects[0]["name"], "Default");
    assert_eq!(projects.as_array().map(Vec::len), Some(1));
}

// AC: PL-10.1
#[tokio::test]
async fn projects_are_created_renamed_and_deleted() {
    let (app_router, _) = build_test_app();

    let (create_status, created) = create_project(&app_router, "shop", " Shop ").await;
    let (rename_status, renamed) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/projects/shop",
        Some(&json!({ "name": "Shop team" })),
    )
    .await;
    let keys_before_delete = list_project_keys(&app_router).await;
    let (delete_status, _) = call_api(&app_router, "DELETE", "/api/v1/projects/shop", None).await;

    assert_eq!(create_status, 201, "{created}");
    assert_eq!(created["name"], "Shop");
    assert_eq!(created["email_count"], 0);
    assert_eq!(
        (rename_status, &renamed["name"]),
        (200, &json!("Shop team"))
    );
    assert_eq!(renamed["key"], "shop");
    assert_eq!(keys_before_delete, ["default", "shop"]);
    assert_eq!(delete_status, 204);
    assert_eq!(list_project_keys(&app_router).await, ["default"]);
}

// AC: PL-10.1
#[tokio::test]
async fn keys_apps_cannot_send_as_they_are_and_taken_keys_are_refused() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop", "Shop").await;

    let (invalid_status, invalid_answer) = create_project(&app_router, "My Shop", "Shop").await;
    let (taken_status, taken_answer) = create_project(&app_router, "shop", "Another").await;
    let (nameless_status, _) = create_project(&app_router, "blog", " ").await;

    assert_eq!(invalid_status, 400);
    assert_eq!(invalid_answer["error"]["field"], "key");
    assert_eq!(taken_status, 409);
    assert_eq!(taken_answer["error"]["code"], "project_exists");
    assert_eq!(nameless_status, 400);
}

// AC: PL-10.1
#[tokio::test]
async fn the_default_project_cannot_be_deleted_and_unknown_projects_are_not_found() {
    let (app_router, _) = build_test_app();

    let (default_status, default_answer) =
        call_api(&app_router, "DELETE", "/api/v1/projects/default", None).await;
    let (missing_status, _) =
        call_api(&app_router, "DELETE", "/api/v1/projects/nowhere", None).await;
    let (rename_missing_status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/projects/nowhere",
        Some(&json!({ "name": "Nowhere" })),
    )
    .await;

    assert_eq!(default_status, 409);
    assert_eq!(default_answer["error"]["code"], "default_project");
    assert_eq!((missing_status, rename_missing_status), (404, 404));
}
