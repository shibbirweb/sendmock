#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app, build_test_app_with, call_api};
use support::webhook_samples::{create_endpoint, create_rule};

const VERIFY_LINK: &str = "https://app.test/verify?token=abc123";
const HELP_LINK: &str = "https://app.test/help";

async fn send_email_with_links(app_router: &axum::Router) -> String {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "no-reply@app.test",
            "to": ["sam@example.test"],
            "subject": "Verify your email",
            "html": format!("<p><a href=\"{VERIFY_LINK}\">Verify</a> or <a href=\"{HELP_LINK}\">get help</a></p>"),
        })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
    sent["id"].as_str().unwrap_or_default().to_owned()
}

async fn click_link(app_router: &axum::Router, email_id: &str, click_body: Value) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/clicks"),
        Some(&click_body),
    )
    .await
}

async fn read_json(app_router: &axum::Router, path: &str) -> Value {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{answer}");
    answer
}

/// The `email.clicked` events' data, oldest first.
async fn clicked_event_data(app_router: &axum::Router) -> Vec<Value> {
    let recent = read_json(app_router, "/api/v1/events/recent?type=email.clicked").await;
    let mut event_data: Vec<Value> = recent
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|recent_event| recent_event["data"].clone())
        .collect();
    event_data.reverse();
    event_data
}

// AC: EM-20.2
#[tokio::test]
async fn an_api_click_on_one_of_the_emails_links_fires_email_clicked() {
    let (app_router, _) = build_test_app();
    let email_id = send_email_with_links(&app_router).await;

    let (status, _) = click_link(&app_router, &email_id, json!({ "url": VERIFY_LINK })).await;
    let (manual_status, _) = click_link(
        &app_router,
        &email_id,
        json!({ "url": VERIFY_LINK, "source": "manual" }),
    )
    .await;

    assert_eq!((status, manual_status), (204, 204));
    let sources: Vec<Value> = clicked_event_data(&app_router)
        .await
        .iter()
        .map(|event_data| event_data["source"].clone())
        .collect();
    assert_eq!(sources, [json!("api"), json!("manual")]);
}

// AC: EM-20.2
#[tokio::test]
async fn a_url_that_is_not_one_of_the_emails_links_is_refused() {
    let (app_router, _) = build_test_app();
    let email_id = send_email_with_links(&app_router).await;

    let (status, refusal) = click_link(
        &app_router,
        &email_id,
        json!({ "url": "https://elsewhere.test/" }),
    )
    .await;
    let (missing_status, _) = click_link(
        &app_router,
        "01JCK0000000000000000000ZZ",
        json!({ "url": VERIFY_LINK }),
    )
    .await;

    assert_eq!(status, 422);
    assert_eq!(refusal["error"]["code"], "unknown_link");
    assert!(
        refusal["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains(VERIFY_LINK),
        "{refusal}"
    );
    assert_eq!(missing_status, 404);
    assert!(clicked_event_data(&app_router).await.is_empty());
}

/// Two clicks on the verify link (the first with a user agent), then one on the help link from the UI.
async fn click_three_times(app_router: &axum::Router, email_id: &str) {
    click_link(
        app_router,
        email_id,
        json!({ "url": VERIFY_LINK, "user_agent": "Test agent" }),
    )
    .await;
    click_link(app_router, email_id, json!({ "url": VERIFY_LINK })).await;
    click_link(
        app_router,
        email_id,
        json!({ "url": HELP_LINK, "source": "ui" }),
    )
    .await;
}

// AC: EM-20.3
#[tokio::test]
async fn the_history_detail_and_timeline_carry_each_click() {
    let (app_router, _) = build_test_app();
    let email_id = send_email_with_links(&app_router).await;

    click_three_times(&app_router, &email_id).await;
    let clicks = read_json(&app_router, &format!("/api/v1/emails/{email_id}/clicks")).await;
    let detail = read_json(&app_router, &format!("/api/v1/emails/{email_id}")).await;
    let timeline = read_json(&app_router, &format!("/api/v1/emails/{email_id}/timeline")).await;

    let clicked_urls: Vec<&Value> = clicks
        .as_array()
        .into_iter()
        .flatten()
        .map(|click| &click["url"])
        .collect();
    assert_eq!(clicked_urls, [HELP_LINK, VERIFY_LINK, VERIFY_LINK]);
    assert_eq!(clicks[2]["user_agent"], "Test agent");
    assert_eq!(detail["click_count"], 3);
    assert!(
        timeline
            .to_string()
            .contains("Link clicked in the SendMock preview"),
        "{timeline}"
    );
}

// AC: EM-20.3
#[tokio::test]
async fn each_event_carries_the_link_first_click_and_click_count() {
    let (app_router, _) = build_test_app();
    let email_id = send_email_with_links(&app_router).await;

    click_three_times(&app_router, &email_id).await;
    let events = clicked_event_data(&app_router).await;

    let first_clicks: Vec<(Value, Value)> = events
        .iter()
        .map(|event_data| {
            (
                event_data["first_click"].clone(),
                event_data["click_count"].clone(),
            )
        })
        .collect();
    assert_eq!(
        first_clicks,
        [
            (json!(true), json!(1)),
            (json!(false), json!(2)),
            (json!(true), json!(3))
        ]
    );
    assert_eq!(events[0]["subject"], "Verify your email");
    assert_eq!(events[0]["url"], VERIFY_LINK);
    assert_eq!(events[0]["user_agent"], "Test agent");
}

// AC: EM-20.4
#[tokio::test]
async fn a_rule_matches_email_clicked_and_filters_on_the_first_click() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_endpoint(&app_router, "Click tracking").await;
    create_rule(
        &app_router,
        &json!({
            "name": "First clicks", "endpoint_id": endpoint_id,
            "events": ["email.clicked"], "is_enabled": true,
            "filter": { "field": "first_click", "operator": "equals", "value": "true" },
        }),
    )
    .await;
    let email_id = send_email_with_links(&app_router).await;

    click_link(&app_router, &email_id, json!({ "url": VERIFY_LINK })).await;
    click_link(&app_router, &email_id, json!({ "url": VERIFY_LINK })).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    subscriber.abort();

    let deliveries = read_json(&app_router, "/api/v1/webhooks/deliveries").await;
    let delivered_events: Vec<&Value> = deliveries["items"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|delivery| &delivery["event_type"])
        .collect();
    assert_eq!(delivered_events, ["email.clicked"]);
}
