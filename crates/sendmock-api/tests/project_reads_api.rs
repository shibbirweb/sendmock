#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod project_requests;
    pub mod test_app;
    pub mod webhook_samples;
}

use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::project_requests::{create_project, post_in_project};
use support::test_app::{build_test_app, build_test_app_with, call_api};
use support::webhook_samples::{create_endpoint, create_rule};

const RECIPIENT: &str = "sam@example.test";
const PHONE: &str = "+8801700000000";
/// The number in a query string, where a bare `+` reads as a space.
const PHONE_IN_URL: &str = "%2B8801700000000";

fn email_with_code(code: &str) -> Value {
    json!({
        "from": "no-reply@shop.test", "to": [RECIPIENT], "subject": format!("Code {code}"),
        "text": format!("Your code is {code}. Open https://shop.test/verify?code={code}"),
    })
}

fn sms_with_code(code: &str) -> Value {
    json!({ "from": "+15550001111", "to": PHONE, "body": format!("Your code is {code}") })
}

async fn send_email(app_router: &axum::Router, code: &str, project_key: &str) {
    let (status, sent) = post_in_project(
        app_router,
        "/api/v1/send",
        &email_with_code(code),
        project_key,
    )
    .await;
    assert_eq!(status, 201, "{sent}");
}

/// The same recipient and numbers in both projects, `shop` first so `default` holds the
/// newest of each: a read without a project would answer `default`'s.
async fn fill_both_projects(app_router: &axum::Router) {
    create_project(app_router, "shop").await;
    send_email(app_router, "222222", "shop").await;
    post_in_project(app_router, "/api/v1/sms", &sms_with_code("2222"), "shop").await;
    post_in_project(
        app_router,
        "/api/v1/samples/verification",
        &json!({}),
        "shop",
    )
    .await;
    send_email(app_router, "111111", "default").await;
    post_in_project(app_router, "/api/v1/sms", &sms_with_code("1111"), "default").await;
    post_in_project(
        app_router,
        "/api/v1/samples/verification",
        &json!({}),
        "default",
    )
    .await;
}

async fn read(app_router: &axum::Router, path: &str) -> Value {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{path}: {answer}");
    answer
}

/// The conversation with the contact number the native SMS went to.
fn find_phone_thread(threads: &Value) -> Value {
    threads
        .as_array()
        .into_iter()
        .flatten()
        .find(|thread| thread["contact_number"] == PHONE)
        .cloned()
        .unwrap_or_else(|| panic!("no conversation with {PHONE}: {threads}"))
}

fn item_projects(page: &Value) -> Vec<Value> {
    page["items"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|item| item["project"].clone())
        .collect()
}

// AC: PL-10.5
#[tokio::test]
async fn lists_take_a_project_and_answer_every_project_without_one() {
    let (app_router, _) = build_test_app();
    fill_both_projects(&app_router).await;

    let shop_emails = read(&app_router, "/api/v1/emails?project=shop").await;
    let all_emails = read(&app_router, "/api/v1/emails").await;
    let shop_sms = read(
        &app_router,
        &format!("/api/v1/sms?project=shop&to={PHONE_IN_URL}"),
    )
    .await;
    let shop_verifications = read(&app_router, "/api/v1/verify?project=shop").await;
    let shop_threads = read(&app_router, "/api/v1/sms/threads?project=shop").await;
    let all_threads = read(&app_router, "/api/v1/sms/threads").await;

    assert_eq!(item_projects(&shop_emails), [json!("shop")]);
    assert_eq!(item_projects(&all_emails).len(), 2);
    assert_eq!(item_projects(&shop_sms), [json!("shop")]);
    assert_eq!(item_projects(&shop_verifications), [json!("shop")]);
    assert_eq!(find_phone_thread(&shop_threads)["message_count"], 1);
    assert_eq!(
        find_phone_thread(&shop_threads)["last_message"]["project"],
        "shop"
    );
    assert_eq!(find_phone_thread(&all_threads)["message_count"], 2);
}

// AC: PL-10.5
#[tokio::test]
async fn lookups_and_waits_read_only_the_projects_messages() {
    let (app_router, _) = build_test_app();
    fill_both_projects(&app_router).await;

    let shop_code = read(
        &app_router,
        &format!("/api/v1/otp?to={RECIPIENT}&project=shop"),
    )
    .await;
    let newest_code = read(&app_router, &format!("/api/v1/otp?to={RECIPIENT}")).await;
    let shop_links = read(
        &app_router,
        &format!("/api/v1/links?to={RECIPIENT}&project=shop"),
    )
    .await;
    let shop_latest = read(
        &app_router,
        &format!("/api/v1/emails/latest?to={RECIPIENT}&project=shop"),
    )
    .await;
    let shop_wait = read(
        &app_router,
        &format!("/api/v1/wait/email?to={RECIPIENT}&project=shop"),
    )
    .await;
    let shop_sms_wait = read(
        &app_router,
        &format!("/api/v1/wait/sms?to={PHONE_IN_URL}&project=shop"),
    )
    .await;

    assert_eq!(shop_code["code"], "222222");
    assert_eq!(newest_code["code"], "111111");
    assert_eq!(
        shop_links["links"][0],
        "https://shop.test/verify?code=222222"
    );
    assert_eq!(shop_latest["subject"], "Code 222222");
    assert_eq!(shop_wait["project"], "shop");
    assert_eq!(shop_sms_wait["body"], "Your code is 2222");
}

// AC: PL-10.5 PL-10.6
#[tokio::test]
async fn events_carry_their_project_and_recent_events_filter_on_it() {
    let (app_router, _) = build_test_app();
    fill_both_projects(&app_router).await;

    let shop_events = read(&app_router, "/api/v1/events/recent?project=shop").await;
    let all_events = read(&app_router, "/api/v1/events/recent").await;

    let shop_event_projects: Vec<&Value> = shop_events
        .as_array()
        .into_iter()
        .flatten()
        .map(|app_event| &app_event["data"]["project"])
        .collect();
    let event_types: Vec<&Value> = shop_events
        .as_array()
        .into_iter()
        .flatten()
        .map(|app_event| &app_event["type"])
        .collect();
    assert!(!shop_event_projects.is_empty());
    assert!(
        shop_event_projects.iter().all(|project| *project == "shop"),
        "{shop_events}"
    );
    assert!(
        event_types.contains(&&json!("email.received")),
        "{event_types:?}"
    );
    assert!(
        event_types.contains(&&json!("verify.started")),
        "{event_types:?}"
    );
    assert!(all_events.as_array().map(Vec::len) > shop_events.as_array().map(Vec::len));
}

// AC: PL-10.6
#[tokio::test]
async fn a_webhook_rule_filters_on_the_project() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    create_project(&app_router, "shop").await;
    let endpoint_id = create_endpoint(&app_router, "Shop mail").await;
    create_rule(
        &app_router,
        &json!({
            "name": "Shop only", "endpoint_id": endpoint_id,
            "events": ["email.received"], "is_enabled": true,
            "filter": { "field": "project", "operator": "equals", "value": "shop" },
        }),
    )
    .await;

    send_email(&app_router, "222222", "shop").await;
    send_email(&app_router, "111111", "default").await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    subscriber.abort();

    let deliveries = read(&app_router, "/api/v1/webhooks/deliveries").await;
    assert_eq!(
        deliveries["items"].as_array().map(Vec::len),
        Some(1),
        "{deliveries}"
    );
    assert_eq!(deliveries["items"][0]["event_type"], "email.received");
}
