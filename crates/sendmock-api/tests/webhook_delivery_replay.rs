#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use serde_json::{Value, json};
use support::scripted_webhook_sender::ScriptedAnswer;
use support::test_app::call_api;
use support::webhook_send_fixture::{WebhookSendFixture, build_send_fixture, global_variable};

fn delivery_id_of(webhook_delivery: &Value) -> String {
    webhook_delivery["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

/// An endpoint whose body prints a global variable, and one sent delivery of it; answers the
/// delivery id and the variable id.
async fn send_greeting(fixture: &WebhookSendFixture) -> (String, Value) {
    let greeting_variable = fixture
        .create_variable(&global_variable("greeting", "text", "hello"))
        .await;
    let endpoint_id = fixture
        .create_endpoint(json!({
            "body_mode": "raw", "raw_content_type": "application/json",
            "raw_body": r#"{"greeting": "{{ vars.greeting }}"}"#,
        }))
        .await;
    let manual_delivery = fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    (
        delivery_id_of(&manual_delivery),
        greeting_variable["id"].clone(),
    )
}

async fn change_greeting(fixture: &WebhookSendFixture, variable_id: &Value, greeting: &str) {
    let variable_id = variable_id.as_str().unwrap_or_default();
    let (status, updated_variable) = call_api(
        &fixture.app_router,
        "PATCH",
        &format!("/api/v1/webhooks/variables/{variable_id}"),
        Some(&global_variable("greeting", "text", greeting)),
    )
    .await;
    assert_eq!(status, 200, "{updated_variable}");
}

// AC: WH-05.2
#[tokio::test]
async fn replay_as_is_resends_the_stored_request_as_a_new_message() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(500), ScriptedAnswer::Status(200)]);
    let (delivery_id, variable_id) = send_greeting(&fixture).await;
    change_greeting(&fixture, &variable_id, "changed").await;

    let replayed_delivery = fixture
        .replay(&delivery_id, &json!({ "rerender": false }))
        .await;
    fixture.run_due().await;

    assert_eq!(replayed_delivery["trigger"], "replay");
    assert_eq!(replayed_delivery["attempt"], 1);
    let sent_requests = fixture.sent_requests();
    assert_eq!(sent_requests.len(), 2);
    assert_eq!(sent_requests[1].body, sent_requests[0].body);
    assert_ne!(
        sent_requests[1].headers.get("webhook-id"),
        sent_requests[0].headers.get("webhook-id")
    );
}

// AC: WH-05.2
#[tokio::test]
async fn re_render_uses_the_variables_as_they_are_now() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let (delivery_id, variable_id) = send_greeting(&fixture).await;
    change_greeting(&fixture, &variable_id, "changed").await;

    fixture
        .replay(&delivery_id, &json!({ "rerender": true }))
        .await;
    fixture.run_due().await;

    assert_eq!(fixture.last_sent_body(), r#"{"greeting": "changed"}"#);
}

// AC: WH-05.2
#[tokio::test]
async fn edit_and_replay_sends_the_edited_body_and_headers_signed_afresh() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let (delivery_id, _) = send_greeting(&fixture).await;
    let edited_headers = json!({
        "content-type": "application/json", "X-Replay": "1",
        "webhook-id": "msg_stale", "Webhook-Signature": "v1,stale",
    });

    fixture
        .replay(
            &delivery_id,
            &json!({ "rerender": false, "body": "{\"edited\":1}", "headers": edited_headers }),
        )
        .await;
    fixture.run_due().await;

    let replayed_request = fixture.sent_requests().pop();
    let replayed_request = replayed_request.unwrap_or_else(|| panic!("the replay was sent"));
    assert_eq!(replayed_request.body, "{\"edited\":1}");
    assert_eq!(
        replayed_request.headers.get("X-Replay").map(String::as_str),
        Some("1")
    );
    assert!(!replayed_request.headers.contains_key("Webhook-Signature"));
    let webhook_id = replayed_request.headers.get("webhook-id").cloned();
    assert_ne!(webhook_id.as_deref(), Some("msg_stale"));
    let signature = replayed_request.headers.get("webhook-signature").cloned();
    assert!(signature.unwrap_or_default().starts_with("v1,"));
}

// AC: WH-05.2
#[tokio::test]
async fn a_delivery_that_never_rendered_cannot_be_replayed_as_is() {
    let fixture = build_send_fixture(&[]);
    let endpoint_id = fixture
        .create_endpoint(json!({ "headers": { "X-Token": "{{ vars.missing }}" } }))
        .await;
    let failed_delivery = fixture.send_manually(&endpoint_id, &json!({})).await;

    let (status, refusal) = fixture
        .post(
            &format!(
                "/api/v1/webhooks/deliveries/{}/replay",
                delivery_id_of(&failed_delivery)
            ),
            &json!({ "rerender": false }),
        )
        .await;

    assert_eq!(status, 409, "{refusal}");
    assert_eq!(refusal["error"]["code"], "nothing_to_replay");
}

#[tokio::test]
async fn replaying_an_unknown_delivery_is_not_found() {
    let fixture = build_send_fixture(&[]);

    let (status, _) = fixture
        .post(
            "/api/v1/webhooks/deliveries/missing/replay",
            &json!({ "rerender": false }),
        )
        .await;

    assert_eq!(status, 404);
}

// AC: WH-01.2
#[tokio::test]
async fn re_rendering_a_test_ping_keeps_the_test_body() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let (_, test_delivery) = fixture
        .post(
            &format!("/api/v1/webhooks/endpoints/{endpoint_id}/test"),
            &json!({}),
        )
        .await;

    fixture
        .replay(
            &delivery_id_of(&test_delivery),
            &json!({ "rerender": true }),
        )
        .await;
    fixture.run_due().await;

    let replayed_body: Value = serde_json::from_str(&fixture.last_sent_body())
        .unwrap_or_else(|error| panic!("a JSON body: {error}"));
    assert_eq!(replayed_body["type"], "test.ping");
}
