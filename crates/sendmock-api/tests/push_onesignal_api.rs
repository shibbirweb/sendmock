#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod project_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::project_requests::{create_project, post_in_project};
use support::test_app::{build_test_app, call_api};

const ONESIGNAL_PATH: &str = "/providers/onesignal/notifications";

fn onesignal_notification(recipients: Value) -> Value {
    let mut notification = json!({
        "app_id": "5eb5a37e-b458-11e3-ac11-000c2940e62c",
        "headings": { "en": "Your order shipped" },
        "contents": { "en": "Track it in the app.", "es": "Siga su pedido." },
        "data": { "order_id": "1042" },
        "big_picture": "https://shop.test/parcel.png",
        "is_android": true,
    });
    if let (Some(notification_fields), Some(recipient_fields)) =
        (notification.as_object_mut(), recipients.as_object())
    {
        notification_fields.extend(recipient_fields.clone());
    }
    notification
}

async fn list_pushes(app_router: &axum::Router, query: &str) -> Value {
    let (status, page) = call_api(app_router, "GET", &format!("/api/v1/push{query}"), None).await;
    assert_eq!(status, 200, "{page}");
    page
}

// AC: PN-01.3
#[tokio::test]
async fn a_notification_is_stored_for_each_subscription_and_alias_and_answers_its_id() {
    let (app_router, _) = build_test_app();
    let notification = onesignal_notification(json!({
        "include_subscription_ids": ["subscription-1"],
        "include_aliases": { "external_id": ["user-7"] },
    }));

    let (status, answer) = call_api(&app_router, "POST", ONESIGNAL_PATH, Some(&notification)).await;
    let page = list_pushes(&app_router, "?provider=onesignal").await;

    assert_eq!(status, 200, "{answer}");
    let notification_id = answer["id"].as_str().unwrap_or_default();
    assert_eq!(notification_id.len(), 36);
    assert_eq!(answer["external_id"], Value::Null);
    assert_eq!(page["total_count"], 2);
    let device_tokens: Vec<&Value> = page["items"]
        .as_array()
        .map(|items| items.iter().map(|item| &item["device_token"]).collect())
        .unwrap_or_default();
    assert!(device_tokens.contains(&&json!("subscription-1")));
    assert!(device_tokens.contains(&&json!("external_id:user-7")));
    let stored = &page["items"][0];
    assert_eq!(stored["provider_message_id"], notification_id);
    assert_eq!(stored["title"], "Your order shipped");
    assert_eq!(stored["body"], "Track it in the app.");
    assert_eq!(stored["image_url"], "https://shop.test/parcel.png");
    assert_eq!(stored["platform"], "android");
    assert_eq!(stored["data"]["order_id"], "1042");
}

// AC: PN-01.3
#[tokio::test]
async fn the_provider_port_answers_onesignal_in_a_project_and_a_segment_send_is_one_target() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    create_project(&app_router, "shop").await;
    let notification = onesignal_notification(json!({
        "included_segments": ["Subscribed Users"],
        "external_id": "order-1042-shipped",
    }));

    let (status, answer) = post_in_project(
        &provider_port_router,
        "/notifications",
        &notification,
        "shop",
    )
    .await;
    let page = list_pushes(&app_router, "?project=shop").await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(answer["external_id"], "order-1042-shipped");
    assert_eq!(page["total_count"], 1);
    assert_eq!(page["items"][0]["device_token"], "segment:Subscribed Users");
}

// AC: PN-01.3
#[tokio::test]
async fn a_notification_without_recipients_or_contents_is_refused_in_onesignals_shape() {
    let (app_router, _) = build_test_app();
    let mut no_contents = onesignal_notification(json!({
        "include_subscription_ids": ["subscription-1"],
    }));
    no_contents["contents"] = json!({});

    let (no_recipients_status, no_recipients) = call_api(
        &app_router,
        "POST",
        ONESIGNAL_PATH,
        Some(&onesignal_notification(json!({}))),
    )
    .await;
    let (no_contents_status, no_contents_answer) =
        call_api(&app_router, "POST", ONESIGNAL_PATH, Some(&no_contents)).await;

    assert_eq!(no_recipients_status, 400);
    assert!(
        no_recipients["errors"][0]
            .as_str()
            .unwrap_or_default()
            .starts_with("You must include which players")
    );
    assert_eq!(no_contents_status, 400);
    assert_eq!(
        no_contents_answer["errors"][0],
        "Notifications must have English language content"
    );
    assert_eq!(list_pushes(&app_router, "").await["total_count"], 0);
}
