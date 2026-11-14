#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod project_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::project_requests::create_project;
use support::test_app::{build_test_app, call_api, call_api_text};

const SHOP_SEED: &str = "[[projects]]\nkey = \"shop\"\nname = \"Shop\"\n";

async fn export_seed(app_router: &axum::Router) -> String {
    let (status, _, seed_toml) = call_api_text(app_router, "/api/v1/seed/export").await;
    assert_eq!(status, 200);
    seed_toml
}

async fn apply_seed(app_router: &axum::Router, seed_toml: &str) -> Value {
    let (status, answer) = call_api(
        app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
    answer
}

async fn list_projects(app_router: &axum::Router) -> Vec<(String, String)> {
    let (_, projects) = call_api(app_router, "GET", "/api/v1/projects", None).await;
    projects
        .as_array()
        .into_iter()
        .flatten()
        .map(|project| {
            (
                project["key"].as_str().unwrap_or_default().to_owned(),
                project["name"].as_str().unwrap_or_default().to_owned(),
            )
        })
        .collect()
}

fn project_pair(project_key: &str, name: &str) -> (String, String) {
    (project_key.to_owned(), name.to_owned())
}

// AC: PL-10.8
#[tokio::test]
async fn the_seed_export_lists_every_project_but_default() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop").await;

    let seed_toml = export_seed(&app_router).await;

    assert!(seed_toml.contains("[[projects]]"), "{seed_toml}");
    assert!(seed_toml.contains("key = \"shop\""), "{seed_toml}");
    assert!(!seed_toml.contains("key = \"default\""), "{seed_toml}");
}

// AC: PL-10.8
#[tokio::test]
async fn applying_a_seed_adds_its_projects_and_renames_existing_ones() {
    let (app_router, _) = build_test_app();

    apply_seed(&app_router, SHOP_SEED).await;
    let after_first_apply = list_projects(&app_router).await;
    apply_seed(&app_router, &SHOP_SEED.replace("\"Shop\"", "\"Shop team\"")).await;
    let (status, refusal) = call_api(
        &app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": "[[projects]]\nkey = \"My Shop\"\nname = \"Shop\"\n" })),
    )
    .await;

    assert_eq!(
        after_first_apply,
        [
            project_pair("default", "Default"),
            project_pair("shop", "Shop")
        ]
    );
    assert_eq!(
        list_projects(&app_router).await,
        [
            project_pair("default", "Default"),
            project_pair("shop", "Shop team")
        ]
    );
    assert_ne!(status, 200, "{refusal}");
}

// AC: PL-10.8
#[tokio::test]
async fn reset_keeps_projects_and_restores_the_seeds_projects() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "blog").await;

    call_api(&app_router, "POST", "/api/v1/reset", None).await;
    let without_seed = list_projects(&app_router).await;
    apply_seed(&app_router, SHOP_SEED).await;
    call_api(&app_router, "POST", "/api/v1/reset", None).await;

    assert_eq!(
        without_seed,
        [
            project_pair("default", "Default"),
            project_pair("blog", "blog")
        ]
    );
    assert_eq!(
        list_projects(&app_router).await,
        [
            project_pair("default", "Default"),
            project_pair("shop", "Shop")
        ]
    );
}
