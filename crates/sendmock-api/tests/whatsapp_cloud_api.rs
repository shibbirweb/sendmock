#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::email_provider_requests::send_provider_request;
use support::test_app::{build_test_app, call_api};

const MESSAGES_PATH: &str = "/providers/whatsapp_cloud/v21.0/106540352242922/messages";
const CUSTOMER: &str = "16505551234";

fn cloud_message(message_type: &str, type_object: Value) -> Value {
    json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": CUSTOMER,
        "type": message_type,
        message_type: type_object,
    })
}

async fn list_cloud_messages(app_router: &axum::Router) -> Value {
    let (status, page) = call_api(app_router, "GET", "/api/v1/sms?api=whatsapp_cloud", None).await;
    assert_eq!(status, 200, "{page}");
    page
}

// AC: SM-18.1
#[tokio::test]
async fn a_text_message_is_stored_as_whatsapp_and_answered_in_metas_shape() {
    let (app_router, _) = build_test_app();

    let (status, answer) = call_api(
        &app_router,
        "POST",
        MESSAGES_PATH,
        Some(&cloud_message(
            "text",
            json!({ "body": "Your order shipped" }),
        )),
    )
    .await;
    let page = list_cloud_messages(&app_router).await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(answer["messaging_product"], "whatsapp");
    assert_eq!(
        answer["contacts"][0],
        json!({ "input": CUSTOMER, "wa_id": CUSTOMER })
    );
    let wamid = answer["messages"][0]["id"].as_str().unwrap_or_default();
    assert!(wamid.starts_with("wamid."), "{wamid}");
    let stored = &page["items"][0];
    assert_eq!(stored["channel"], "whatsapp");
    assert_eq!(stored["body"], "Your order shipped");
    assert_eq!(stored["to_number"], format!("+{CUSTOMER}"));
    assert_eq!(stored["from_number"], "+15550783881");
    assert_eq!(stored["provider_id"], wamid);
}

// AC: SM-18.1
#[tokio::test]
async fn templates_and_other_types_are_stored_with_a_readable_body() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    let template = json!({
        "name": "order_update", "language": { "code": "en_US" },
        "components": [{ "type": "body", "parameters": [{ "type": "text", "text": "1042" }] }],
    });

    let (template_status, template_answer) = call_api(
        &provider_port_router,
        "POST",
        "/v21.0/106540352242922/messages",
        Some(&cloud_message("template", template)),
    )
    .await;
    call_api(
        &app_router,
        "POST",
        MESSAGES_PATH,
        Some(&cloud_message(
            "reaction",
            json!({ "message_id": "wamid.X", "emoji": "\u{1F44D}" }),
        )),
    )
    .await;
    let page = list_cloud_messages(&app_router).await;

    assert_eq!(template_status, 200, "{template_answer}");
    assert_eq!(template_answer["messages"][0]["message_status"], "accepted");
    assert_eq!(page["items"][0]["body"], "Reacted \u{1F44D}");
    assert_eq!(
        page["items"][1]["body"],
        "Template order_update (en_US)\n1042"
    );
}

// AC: SM-18.2
#[tokio::test]
async fn an_invalid_request_gets_graphs_error_and_stores_nothing() {
    let (app_router, _) = build_test_app();
    let mut wrong_product = cloud_message("text", json!({ "body": "Hi" }));
    wrong_product["messaging_product"] = json!("sms");

    let (no_body_status, no_body) = call_api(
        &app_router,
        "POST",
        MESSAGES_PATH,
        Some(&cloud_message("text", json!({}))),
    )
    .await;
    let (wrong_product_status, _) =
        call_api(&app_router, "POST", MESSAGES_PATH, Some(&wrong_product)).await;

    assert_eq!((no_body_status, wrong_product_status), (400, 400));
    let graph_error = &no_body["error"];
    assert_eq!(graph_error["type"], "OAuthException");
    assert_eq!(graph_error["code"], 100);
    assert_eq!(
        graph_error["message"],
        "(#100) The parameter text['body'] is required."
    );
    assert_eq!(graph_error["error_data"]["messaging_product"], "whatsapp");
    assert!(graph_error["fbtrace_id"].is_string());
    assert_eq!(list_cloud_messages(&app_router).await["total_count"], 0);
}

// AC: SM-18.2
#[tokio::test]
async fn a_read_receipt_marks_the_conversation_read() {
    let (app_router, _) = build_test_app();
    let (_, answer) = call_api(
        &app_router,
        "POST",
        MESSAGES_PATH,
        Some(&cloud_message(
            "text",
            json!({ "body": "Your order shipped" }),
        )),
    )
    .await;
    let reply = json!({
        "from": format!("+{CUSTOMER}"), "to": "+15550783881",
        "body": "Thanks!", "channel": "whatsapp",
    });
    call_api(&app_router, "POST", "/api/v1/sms/inbound", Some(&reply)).await;
    let read_receipt = json!({
        "messaging_product": "whatsapp", "status": "read",
        "message_id": answer["messages"][0]["id"],
    });

    let (status, read_answer) =
        call_api(&app_router, "POST", MESSAGES_PATH, Some(&read_receipt)).await;
    let (unknown_status, _) = call_api(
        &app_router,
        "POST",
        MESSAGES_PATH,
        Some(&json!({ "messaging_product": "whatsapp", "status": "read", "message_id": "wamid.unknown" })),
    )
    .await;
    let (_, threads) = call_api(&app_router, "GET", "/api/v1/sms/threads", None).await;

    assert_eq!((status, read_answer), (200, json!({ "success": true })));
    assert_eq!(unknown_status, 400);
    assert_eq!(threads[0]["unread_count"], 0, "{threads}");
}

// AC: SM-18.1
#[tokio::test]
async fn mailguns_v3_messages_path_on_the_provider_port_is_not_taken_for_the_cloud_api() {
    let (_, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    let form_body = "from=shop%40mg.example.test&to=sam%40example.test&subject=Hi&text=Hello";

    let reply = send_provider_request(
        &provider_port_router,
        "/v3/mg.example.test/messages",
        "application/x-www-form-urlencoded",
        form_body.as_bytes().to_vec(),
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body["message"], "Queued. Thank you.");
}
