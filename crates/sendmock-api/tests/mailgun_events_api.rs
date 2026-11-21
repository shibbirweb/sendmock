#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const DOMAIN: &str = "mg.shop.test";
const EVENTS_PATH: &str = "/providers/mailgun/v3/mg.shop.test/events";
const COMPLAINTS_PATH: &str = "/providers/mailgun/v3/mg.shop.test/complaints";

async fn call_mailgun(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/x-www-form-urlencoded")
        .header("host", "127.0.0.1:8025")
        .body(Body::from(form_body.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    )
}

/// Sends one email through Mailgun for the domain; answers SendMock's id of the stored email.
async fn send_through_mailgun(app_router: &axum::Router, recipient: &str, subject: &str) -> String {
    let boundary = "sendmock-boundary";
    let mut multipart_body = String::new();
    for (field_name, field_value) in [
        ("from", "shop@mg.shop.test"),
        ("to", recipient),
        ("subject", subject),
        ("text", "Hello"),
    ] {
        multipart_body.push_str(&format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"{field_name}\"\r\n\r\n{field_value}\r\n"
        ));
    }
    multipart_body.push_str(&format!("--{boundary}--\r\n"));
    let request = Request::post(format!("/providers/mailgun/v3/{DOMAIN}/messages"))
        .header(
            "content-type",
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(multipart_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let status = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"))
        .status()
        .as_u16();
    assert_eq!(status, 200);
    let (_, email_page) = call_api(app_router, "GET", "/api/v1/emails", None).await;
    email_page["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

async fn simulate(app_router: &axum::Router, email_id: &str, outcome: Value) {
    let (status, answer) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/simulate"),
        Some(&outcome),
    )
    .await;
    assert!(status < 300, "{answer}");
}

fn read_event_names(events_page: &Value) -> Vec<String> {
    events_page["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(|item| item["event"].as_str().unwrap_or_default().to_owned())
                .collect()
        })
        .unwrap_or_default()
}

// AC: EM-23.1
#[tokio::test]
async fn the_events_are_the_domains_sends_and_their_outcomes_in_mailguns_shape() {
    let (app_router, _) = build_test_app();
    let delivered_id = send_through_mailgun(&app_router, "ana@example.test", "Your order").await;
    let bounced_id = send_through_mailgun(&app_router, "sam@example.test", "Your invoice").await;
    simulate(&app_router, &delivered_id, json!({ "event": "delivered" })).await;
    simulate(
        &app_router,
        &bounced_id,
        json!({ "event": "bounced", "bounce_type": "hard" }),
    )
    .await;

    let (status, events_page) = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?ascending=yes"),
        "",
    )
    .await;

    assert_eq!(status, 200, "{events_page}");
    let mut event_names = read_event_names(&events_page);
    event_names.sort();
    assert_eq!(event_names, ["accepted", "accepted", "delivered", "failed"]);
    let failed_page = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?event=failed"),
        "",
    )
    .await
    .1;
    let failed_event = &failed_page["items"][0];
    assert_eq!(failed_event["severity"], "permanent");
    assert_eq!(failed_event["recipient"], "sam@example.test");
    assert_eq!(
        failed_event["message"]["headers"]["subject"],
        "Your invoice"
    );
    assert!(failed_event["delivery-status"]["code"].is_number());
    assert!(
        events_page["paging"]["next"]
            .as_str()
            .is_some_and(|url| url.contains("/v3/mg.shop.test/events/"))
    );
}

// AC: EM-23.2
#[tokio::test]
async fn the_events_filters_and_paging_work_as_mailgun_documents() {
    let (app_router, _) = build_test_app();
    let first_id = send_through_mailgun(&app_router, "ana@example.test", "Welcome").await;
    send_through_mailgun(&app_router, "sam@example.test", "Receipt").await;
    simulate(&app_router, &first_id, json!({ "event": "delivered" })).await;

    let (_, delivered_page) = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?event=delivered"),
        "",
    )
    .await;
    let (_, recipient_page) = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?recipient=sam%40example.test"),
        "",
    )
    .await;
    let (_, subject_page) = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?subject=Welcome&event=accepted+OR+delivered"),
        "",
    )
    .await;
    let (_, first_page) = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?limit=2&ascending=yes"),
        "",
    )
    .await;
    let next_url = first_page["paging"]["next"].as_str().unwrap_or_default();
    let next_path = format!(
        "/providers/mailgun{}",
        next_url
            .split("/providers/mailgun")
            .nth(1)
            .unwrap_or_default()
    );
    let (_, second_page) = call_mailgun(&app_router, "GET", &next_path, "").await;

    assert_eq!(read_event_names(&delivered_page), ["delivered"]);
    assert_eq!(read_event_names(&recipient_page), ["accepted"]);
    assert_eq!(read_event_names(&subject_page).len(), 2);
    assert_eq!(read_event_names(&first_page).len(), 2);
    assert_eq!(read_event_names(&second_page).len(), 1);
}

async fn read_complaints(app_router: &axum::Router, path: &str) -> (u16, Value) {
    call_mailgun(app_router, "GET", path, "").await
}

// AC: EM-23.3
#[tokio::test]
async fn a_complaint_is_added_fetched_and_listed_in_mailguns_shapes() {
    let (app_router, _) = build_test_app();
    let one_path = format!("{COMPLAINTS_PATH}/ana@example.test");

    let (add_status, added) = call_mailgun(
        &app_router,
        "POST",
        COMPLAINTS_PATH,
        "address=ana%40example.test",
    )
    .await;
    let (fetch_status, fetched) = read_complaints(&app_router, &one_path).await;
    let (_, listed) = read_complaints(&app_router, COMPLAINTS_PATH).await;

    assert_eq!(add_status, 200, "{added}");
    assert_eq!(added["address"], "ana@example.test");
    assert_eq!(fetch_status, 200);
    assert_eq!(fetched["address"], "ana@example.test");
    assert!(
        fetched["created_at"]
            .as_str()
            .is_some_and(|date| date.ends_with("+0000"))
    );
    assert_eq!(listed["items"].as_array().map(Vec::len), Some(1));
}

// AC: EM-23.3
#[tokio::test]
async fn a_deleted_complaint_answers_404_and_the_whole_table_can_be_cleared() {
    let (app_router, _) = build_test_app();
    let one_path = format!("{COMPLAINTS_PATH}/ana@example.test");
    call_mailgun(
        &app_router,
        "POST",
        COMPLAINTS_PATH,
        "address=ana%40example.test",
    )
    .await;
    call_mailgun(
        &app_router,
        "POST",
        COMPLAINTS_PATH,
        "address=sam%40example.test",
    )
    .await;

    let (delete_status, _) = call_mailgun(&app_router, "DELETE", &one_path, "").await;
    let (missing_status, missing) = read_complaints(&app_router, &one_path).await;
    let (clear_status, _) = call_mailgun(&app_router, "DELETE", COMPLAINTS_PATH, "").await;
    let (_, cleared) = read_complaints(&app_router, COMPLAINTS_PATH).await;

    assert_eq!(delete_status, 200);
    assert_eq!(missing_status, 404);
    assert_eq!(
        missing["message"],
        "No spam complaints found for this address"
    );
    assert_eq!(clear_status, 200);
    assert_eq!(cleared["items"], json!([]));
}

// AC: EM-23.4
#[tokio::test]
async fn a_simulated_complaint_lists_the_address_and_a_later_send_fails_with_suppress_complaint() {
    let (app_router, _) = build_test_app();
    let first_id = send_through_mailgun(&app_router, "ana@example.test", "Hello").await;
    simulate(&app_router, &first_id, json!({ "event": "complained" })).await;

    let (complaint_status, _) = call_mailgun(
        &app_router,
        "GET",
        &format!("{COMPLAINTS_PATH}/ana@example.test"),
        "",
    )
    .await;
    send_through_mailgun(&app_router, "ana@example.test", "Hello again").await;
    let (_, failed_page) = call_mailgun(
        &app_router,
        "GET",
        &format!("{EVENTS_PATH}?event=failed"),
        "",
    )
    .await;

    assert_eq!(complaint_status, 200);
    assert_eq!(failed_page["items"].as_array().map(Vec::len), Some(1));
    assert_eq!(failed_page["items"][0]["reason"], "suppress-complaint");
    assert_eq!(
        failed_page["items"][0]["message"]["headers"]["subject"],
        "Hello again"
    );
}

// AC: EM-23.5
#[tokio::test]
async fn rest_lists_each_domains_complaints_and_clears_them() {
    let (app_router, _) = build_test_app();
    call_mailgun(
        &app_router,
        "POST",
        COMPLAINTS_PATH,
        "address=ana%40example.test",
    )
    .await;
    call_mailgun(
        &app_router,
        "POST",
        "/providers/mailgun/v3/mg.other.test/complaints",
        "address=sam%40example.test",
    )
    .await;

    let (_, every_complaint) =
        call_api(&app_router, "GET", "/api/v1/mailgun/complaints", None).await;
    let (_, one_domain) = call_api(
        &app_router,
        "GET",
        "/api/v1/mailgun/complaints?domain=mg.shop.test",
        None,
    )
    .await;
    let (clear_status, _) = call_api(
        &app_router,
        "DELETE",
        "/api/v1/mailgun/complaints/mg.shop.test",
        None,
    )
    .await;
    let (_, after_clear) = call_api(&app_router, "GET", "/api/v1/mailgun/complaints", None).await;

    assert_eq!(every_complaint.as_array().map(Vec::len), Some(2));
    assert_eq!(one_domain[0]["address"], "ana@example.test");
    assert_eq!(clear_status, 204);
    assert_eq!(after_clear.as_array().map(Vec::len), Some(1));
    assert_eq!(after_clear[0]["domain"], "mg.other.test");
}
