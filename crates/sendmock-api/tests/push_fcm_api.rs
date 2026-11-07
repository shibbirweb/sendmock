#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod project_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::project_requests::{create_project, post_in_project};
use support::test_app::{build_test_app, call_api};

const FCM_SEND_PATH: &str = "/providers/fcm/v1/projects/shop-app/messages:send";

fn fcm_message(target: Value) -> Value {
    let mut message = json!({
        "notification": { "title": "Your order shipped", "body": "Track it in the app." },
        "data": { "order_id": "1042" },
        "android": { "priority": "high" },
    });
    if let (Some(message_fields), Some(target_fields)) =
        (message.as_object_mut(), target.as_object())
    {
        message_fields.extend(target_fields.clone());
    }
    json!({ "message": message })
}

async fn list_pushes(app_router: &axum::Router, query: &str) -> Value {
    let (status, page) = call_api(app_router, "GET", &format!("/api/v1/push{query}"), None).await;
    assert_eq!(status, 200, "{page}");
    page
}

// AC: PN-01.1
#[tokio::test]
async fn an_fcm_send_is_stored_and_answered_with_the_message_name() {
    let (app_router, _) = build_test_app();

    let (status, answer) = call_api(
        &app_router,
        "POST",
        FCM_SEND_PATH,
        Some(&fcm_message(json!({ "token": "device-1" }))),
    )
    .await;
    let page = list_pushes(&app_router, "").await;

    assert_eq!(status, 200, "{answer}");
    let message_name = answer["name"].as_str().unwrap_or_default();
    assert!(
        message_name.starts_with("projects/shop-app/messages/0:"),
        "{message_name}"
    );
    let stored = &page["items"][0];
    assert_eq!(stored["provider"], "fcm");
    assert_eq!(stored["device_token"], "device-1");
    assert_eq!(stored["platform"], "android");
    assert_eq!(stored["title"], "Your order shipped");
    assert_eq!(stored["body"], "Track it in the app.");
    assert_eq!(stored["data"]["order_id"], "1042");
    assert_eq!(stored["provider_message_id"], message_name);
    assert_eq!(stored["status"], "sent");
}

// AC: PN-01.1
#[tokio::test]
async fn the_provider_port_answers_fcm_at_its_real_path() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);

    let (status, answer) = call_api(
        &provider_port_router,
        "POST",
        "/v1/projects/shop-app/messages:send",
        Some(&fcm_message(json!({ "topic": "news" }))),
    )
    .await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(
        list_pushes(&app_router, "").await["items"][0]["device_token"],
        "topic:news"
    );
}

// AC: PN-01.1
#[tokio::test]
async fn a_dry_run_is_answered_without_storing_and_a_message_without_a_target_is_refused() {
    let (app_router, _) = build_test_app();
    let mut dry_run = fcm_message(json!({ "token": "device-1" }));
    dry_run["validate_only"] = json!(true);

    let (dry_run_status, dry_run_answer) =
        call_api(&app_router, "POST", FCM_SEND_PATH, Some(&dry_run)).await;
    let (refused_status, refusal) = call_api(
        &app_router,
        "POST",
        FCM_SEND_PATH,
        Some(&fcm_message(json!({}))),
    )
    .await;

    assert_eq!(dry_run_status, 200);
    assert_eq!(
        dry_run_answer["name"],
        "projects/shop-app/messages/fake_message_id"
    );
    assert_eq!(refused_status, 400);
    assert_eq!(refusal["error"]["status"], "INVALID_ARGUMENT");
    assert_eq!(
        refusal["error"]["details"][0]["@type"],
        "type.googleapis.com/google.firebase.fcm.v1.FcmError"
    );
    assert_eq!(list_pushes(&app_router, "").await["total_count"], 0);
}

// AC: PN-01.5
#[tokio::test]
async fn pushes_are_listed_by_project_and_token_read_waited_for_and_deleted() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop").await;
    post_in_project(
        &app_router,
        FCM_SEND_PATH,
        &fcm_message(json!({ "token": "device-1" })),
        "shop",
    )
    .await;
    call_api(
        &app_router,
        "POST",
        FCM_SEND_PATH,
        Some(&fcm_message(json!({ "token": "device-2" }))),
    )
    .await;

    let shop_page = list_pushes(&app_router, "?project=shop").await;
    let device_two_page = list_pushes(&app_router, "?device_token=device-2").await;
    let push_id = shop_page["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let (detail_status, detail) =
        call_api(&app_router, "GET", &format!("/api/v1/push/{push_id}"), None).await;
    let (wait_status, waited) = call_api(
        &app_router,
        "GET",
        "/api/v1/wait/push?device_token=device-2",
        None,
    )
    .await;
    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("/api/v1/push/{push_id}"),
        None,
    )
    .await;

    assert_eq!(shop_page["total_count"], 1);
    assert_eq!(shop_page["items"][0]["project"], "shop");
    assert_eq!(device_two_page["items"][0]["project"], "default");
    assert_eq!(
        (detail_status, &detail["device_token"]),
        (200, &json!("device-1"))
    );
    assert_eq!(detail["request"]["message"]["token"], "device-1");
    assert_eq!(
        (wait_status, &waited["device_token"]),
        (200, &json!("device-2"))
    );
    assert_eq!(delete_status, 204);
    assert_eq!(list_pushes(&app_router, "").await["total_count"], 1);
}

// AC: PN-01.5
#[tokio::test]
async fn waiting_for_a_push_that_never_comes_times_out() {
    let (app_router, _) = build_test_app();

    let (status, answer) = call_api(
        &app_router,
        "GET",
        "/api/v1/wait/push?device_token=nobody&timeout=200ms",
        None,
    )
    .await;

    assert_eq!(status, 408, "{answer}");
}
