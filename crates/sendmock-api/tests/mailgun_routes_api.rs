#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use std::time::Duration;

use serde_json::{Value, json};
use support::email_provider_requests::send_provider_request;
use support::test_app::{build_test_app, call_api};

const MAILGUN_ROUTES_PATH: &str = "/providers/mailgun/v3/routes";

async fn create_mailgun_route(app_router: &axum::Router, form_body: &str) -> (u16, Value) {
    let reply = send_provider_request(
        app_router,
        MAILGUN_ROUTES_PATH,
        "application/x-www-form-urlencoded",
        form_body.as_bytes().to_vec(),
    )
    .await;
    (reply.status, reply.body)
}

// AC: WH-12.6
#[tokio::test]
async fn routes_made_through_the_mailgun_api_are_the_routes_the_ui_lists() {
    let (app_router, _) = build_test_app();

    let (created_status, created) = create_mailgun_route(
        &app_router,
        "priority=3&description=Support&expression=match_recipient%28%22support%40.%2A%22%29&action=forward%28%22http%3A%2F%2Flocalhost%3A8000%2Fmail%22%29&action=stop%28%29",
    )
    .await;
    let (bad_status, _) =
        create_mailgun_route(&app_router, "expression=explode%28%29&action=stop%28%29").await;
    let (_, ui_routes) = call_api(&app_router, "GET", "/api/v1/inbound-routes", None).await;
    let (_, mailgun_list) = call_api(&app_router, "GET", MAILGUN_ROUTES_PATH, None).await;
    let route_id = created["route"]["id"].as_str().unwrap_or_default();
    let (delete_status, deleted) = call_api(
        &app_router,
        "DELETE",
        &format!("{MAILGUN_ROUTES_PATH}/{route_id}"),
        None,
    )
    .await;

    assert_eq!(created_status, 200, "{created}");
    assert_eq!(created["message"], "Route has been created");
    assert_eq!(
        created["route"]["expression"],
        r#"match_recipient("support@.*")"#
    );
    assert_eq!(
        created["route"]["actions"],
        json!([r#"forward("http://localhost:8000/mail")"#, "stop()"])
    );
    assert_eq!(bad_status, 400);
    assert_eq!(ui_routes[0]["id"], route_id);
    assert_eq!(ui_routes[0]["filter"]["kind"], "match_recipient");
    assert_eq!(ui_routes[0]["actions"][1]["kind"], "stop");
    assert_eq!(mailgun_list["total_count"], 1);
    assert_eq!(delete_status, 200, "{deleted}");
    assert_eq!(deleted["message"], "Route has been deleted");
}

// AC: WH-12.5
#[tokio::test]
async fn the_message_url_answers_the_stored_message_and_its_mime() {
    let (app_router, _) = build_test_app();
    let (_, received) = call_api(
        &app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({ "from": "sam@example.test", "to": ["support@inbound.app.test"], "subject": "Stored", "text": "Keep me" })),
    )
    .await;
    let email_id = received["id"].as_str().unwrap_or_default();
    tokio::time::sleep(Duration::from_millis(10)).await;

    let (status, stored_message) = call_api(
        &app_router,
        "GET",
        &format!("/providers/mailgun/v3/domains/inbound/messages/{email_id}"),
        None,
    )
    .await;
    let (missing_status, _) = call_api(
        &app_router,
        "GET",
        "/providers/mailgun/v3/domains/inbound/messages/01MISSING",
        None,
    )
    .await;

    assert_eq!(status, 200, "{stored_message}");
    assert_eq!(stored_message["Subject"], "Stored");
    assert_eq!(stored_message["sender"], "sam@example.test");
    assert!(
        stored_message["body-plain"]
            .as_str()
            .is_some_and(|text| text.contains("Keep me"))
    );
    assert_eq!(missing_status, 404);
}
