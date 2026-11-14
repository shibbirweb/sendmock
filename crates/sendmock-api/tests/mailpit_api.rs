#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod mailpit_definitions;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::mailpit_definitions::compare_with_mailpit;
use support::test_app::{build_test_app, call_api, call_api_text};

/// "abc", which the attachment's checksums are checked against.
const ATTACHMENT_BASE64: &str = "YWJj";

async fn send_email(app_router: &axum::Router, send_body: Value) -> String {
    let (status, sent) = call_api(app_router, "POST", "/api/v1/send", Some(&send_body)).await;
    assert_eq!(status, 201, "{sent}");
    sent["id"].as_str().unwrap_or_default().to_owned()
}

async fn send_three_emails(app_router: &axum::Router) -> [String; 3] {
    let welcome_id = send_email(
        app_router,
        json!({ "from": "Shop <hello@shop.test>", "to": ["sam@example.test"], "subject": "Welcome", "text": "Hi Sam", "tags": ["signup"] }),
    )
    .await;
    let invoice_id = send_email(
        app_router,
        json!({
            "from": "billing@shop.test",
            "to": ["sam@example.test"],
            "subject": "Invoice 42",
            "text": "Your invoice",
            "html": "<p>Your invoice</p>",
            "attachments": [{ "filename": "invoice.pdf", "content_type": "application/pdf", "content": ATTACHMENT_BASE64 }],
        }),
    )
    .await;
    let reset_id = send_email(
        app_router,
        json!({ "from": "hello@shop.test", "to": ["kim@example.test"], "subject": "Reset your password", "text": "Code 123456" }),
    )
    .await;
    [welcome_id, invoice_id, reset_id]
}

fn list_subjects(messages_summary: &Value) -> Vec<String> {
    messages_summary["messages"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|message| message["Subject"].as_str().unwrap_or_default().to_owned())
        .collect()
}

// AC: EM-19.1 EM-19.5
#[tokio::test]
async fn the_message_list_pages_newest_first_with_mailpits_counts() {
    let (app_router, _) = build_test_app();
    send_three_emails(&app_router).await;

    let (status, first_page) = call_api(&app_router, "GET", "/api/v1/messages?limit=2", None).await;
    let (_, second_page) =
        call_api(&app_router, "GET", "/api/v1/messages?start=2&limit=2", None).await;

    assert_eq!(status, 200);
    assert_eq!(
        compare_with_mailpit(&first_page, "MessagesSummary"),
        Vec::<String>::new()
    );
    assert_eq!(
        list_subjects(&first_page),
        ["Reset your password", "Invoice 42"]
    );
    assert_eq!(list_subjects(&second_page), ["Welcome"]);
    assert_eq!(first_page["total"], 3);
    assert_eq!(first_page["unread"], 3);
    assert_eq!(first_page["messages_count"], 3);
    assert_eq!(second_page["start"], 2);
    assert_eq!(first_page["tags"], json!(["signup"]));
    assert_eq!(first_page["messages"][1]["Attachments"], 1);
}

// AC: EM-19.1 EM-19.5
#[tokio::test]
async fn search_reads_mailpits_filters_and_plain_words() {
    let (app_router, _) = build_test_app();
    send_three_emails(&app_router).await;

    let (_, by_recipient) = call_api(
        &app_router,
        "GET",
        "/api/v1/search?query=to:kim@example.test",
        None,
    )
    .await;
    let (_, by_tag) = call_api(&app_router, "GET", "/api/v1/search?query=tag:signup", None).await;
    let (_, by_attachment) = call_api(
        &app_router,
        "GET",
        "/api/v1/search?query=has:attachment",
        None,
    )
    .await;
    let (_, by_word) = call_api(&app_router, "GET", "/api/v1/search?query=invoice", None).await;

    assert_eq!(
        compare_with_mailpit(&by_recipient, "MessagesSummary"),
        Vec::<String>::new()
    );
    assert_eq!(list_subjects(&by_recipient), ["Reset your password"]);
    assert_eq!(by_recipient["messages_count"], 1);
    assert_eq!(by_recipient["total"], 3);
    assert_eq!(list_subjects(&by_tag), ["Welcome"]);
    assert_eq!(list_subjects(&by_attachment), ["Invoice 42"]);
    assert_eq!(list_subjects(&by_word), ["Invoice 42"]);
}

// AC: EM-19.2 EM-19.5
#[tokio::test]
async fn a_message_reads_as_mailpits_message_and_is_marked_read() {
    let (app_router, _) = build_test_app();
    let [_, invoice_id, _] = send_three_emails(&app_router).await;

    let (status, message) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/message/{invoice_id}"),
        None,
    )
    .await;
    let (_, after_reading) = call_api(&app_router, "GET", "/api/v1/messages", None).await;
    let (_, latest) = call_api(&app_router, "GET", "/api/v1/message/latest", None).await;

    assert_eq!(status, 200);
    assert_eq!(
        compare_with_mailpit(&message, "Message"),
        Vec::<String>::new()
    );
    assert_eq!(message["ID"], invoice_id.as_str());
    assert_eq!(message["From"]["Address"], "billing@shop.test");
    assert_eq!(message["HTML"], "<p>Your invoice</p>");
    assert_eq!(message["Attachments"][0]["FileName"], "invoice.pdf");
    assert_eq!(
        message["Attachments"][0]["Checksums"]["MD5"],
        "900150983cd24fb0d6963f7d28e17f72"
    );
    assert_eq!(after_reading["unread"], 2);
    assert_eq!(latest["Subject"], "Reset your password");
}

// AC: EM-19.2
#[tokio::test]
async fn headers_and_source_answer_as_mailpit_does() {
    let (app_router, _) = build_test_app();
    let [_, invoice_id, _] = send_three_emails(&app_router).await;

    let (_, headers) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/message/{invoice_id}/headers"),
        None,
    )
    .await;
    let (_, source_type, source) =
        call_api_text(&app_router, &format!("/api/v1/message/{invoice_id}/raw")).await;

    let header_names: Vec<&String> = headers
        .as_object()
        .map(|header_map| header_map.keys().collect())
        .unwrap_or_default();
    let mut sorted_names = header_names.clone();
    sorted_names.sort();
    assert_eq!(header_names, sorted_names);
    assert!(
        header_names
            .iter()
            .any(|name| name.eq_ignore_ascii_case("subject")),
        "{headers}"
    );
    assert!(source_type.starts_with("text/plain"), "{source_type}");
    assert!(source.contains("Subject: Invoice 42"), "{source}");
}

// AC: EM-19.2
#[tokio::test]
async fn parts_and_views_answer_as_mailpit_does() {
    let (app_router, _) = build_test_app();
    let [welcome_id, invoice_id, _] = send_three_emails(&app_router).await;
    let (_, message) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/message/{invoice_id}"),
        None,
    )
    .await;
    let part_id = message["Attachments"][0]["PartID"]
        .as_str()
        .unwrap_or_default();

    let (part_status, part_type, part_text) = call_api_text(
        &app_router,
        &format!("/api/v1/message/{invoice_id}/part/{part_id}"),
    )
    .await;
    let (_, html_type, html_view) =
        call_api_text(&app_router, &format!("/view/{invoice_id}.html")).await;
    let (_, _, text_view) = call_api_text(&app_router, &format!("/view/{invoice_id}.txt")).await;
    let (no_html_status, _, _) =
        call_api_text(&app_router, &format!("/view/{welcome_id}.html")).await;

    assert_eq!(
        (part_status, part_type.as_str(), part_text.as_str()),
        (200, "application/pdf", "abc")
    );
    assert!(html_type.starts_with("text/html"), "{html_type}");
    assert_eq!(html_view, "<p>Your invoice</p>");
    assert_eq!(text_view, "Your invoice");
    assert_eq!(no_html_status, 404);
}

// AC: EM-19.2
#[tokio::test]
async fn a_missing_message_or_part_answers_404_with_plain_text() {
    let (app_router, _) = build_test_app();
    let [welcome_id, _, _] = send_three_emails(&app_router).await;

    let (message_status, message_type, message_text) =
        call_api_text(&app_router, "/api/v1/message/01JCK0000000000000000000ZZ").await;
    let (part_status, _, _) =
        call_api_text(&app_router, &format!("/api/v1/message/{welcome_id}/part/9")).await;

    assert_eq!(message_status, 404);
    assert!(message_type.starts_with("text/plain"), "{message_type}");
    assert!(!message_text.is_empty());
    assert_eq!(part_status, 404);
}

// AC: EM-19.3
#[tokio::test]
async fn read_status_is_set_by_ids_by_search_or_for_every_message() {
    let (app_router, _) = build_test_app();
    let [welcome_id, _, _] = send_three_emails(&app_router).await;

    let (all_status, _) = call_api(
        &app_router,
        "PUT",
        "/api/v1/messages",
        Some(&json!({ "Read": true })),
    )
    .await;
    let (_, all_read) = call_api(&app_router, "GET", "/api/v1/messages", None).await;
    call_api(
        &app_router,
        "PUT",
        "/api/v1/messages",
        Some(&json!({ "IDs": [welcome_id], "Read": false })),
    )
    .await;
    let (_, one_unread) = call_api(&app_router, "GET", "/api/v1/messages", None).await;
    call_api(
        &app_router,
        "PUT",
        "/api/v1/messages",
        Some(&json!({ "Search": "to:kim@example.test", "Read": false })),
    )
    .await;
    let (_, two_unread) = call_api(&app_router, "GET", "/api/v1/messages", None).await;

    assert_eq!(all_status, 200);
    assert_eq!(all_read["unread"], 0);
    assert_eq!(one_unread["unread"], 1);
    assert_eq!(two_unread["unread"], 2);
}

// AC: EM-19.3
#[tokio::test]
async fn messages_are_deleted_by_ids_by_search_or_all_at_once() {
    let (app_router, _) = build_test_app();
    let [welcome_id, _, _] = send_three_emails(&app_router).await;

    let (ids_status, _) = call_api(
        &app_router,
        "DELETE",
        "/api/v1/messages",
        Some(&json!({ "IDs": [welcome_id] })),
    )
    .await;
    let (_, after_ids) = call_api(&app_router, "GET", "/api/v1/messages", None).await;
    let (search_status, _) = call_api(
        &app_router,
        "DELETE",
        "/api/v1/search?query=subject:Invoice",
        None,
    )
    .await;
    let (_, after_search) = call_api(&app_router, "GET", "/api/v1/messages", None).await;
    let (no_query_status, _) = call_api(&app_router, "DELETE", "/api/v1/search", None).await;
    let (all_status, _) = call_api(&app_router, "DELETE", "/api/v1/messages", None).await;
    let (_, after_all) = call_api(&app_router, "GET", "/api/v1/messages", None).await;

    assert_eq!((ids_status, search_status, all_status), (200, 200, 200));
    assert_eq!(after_ids["total"], 2);
    assert_eq!(list_subjects(&after_search), ["Reset your password"]);
    assert_eq!(no_query_status, 400);
    assert_eq!(after_all["total"], 0);
}

// AC: EM-19.4
#[tokio::test]
async fn tags_are_listed_and_replaced_per_message() {
    let (app_router, _) = build_test_app();
    let [welcome_id, invoice_id, _] = send_three_emails(&app_router).await;

    let (set_status, _) = call_api(
        &app_router,
        "PUT",
        "/api/v1/tags",
        Some(&json!({ "IDs": [invoice_id], "Tags": ["billing", "qa"] })),
    )
    .await;
    call_api(
        &app_router,
        "PUT",
        "/api/v1/tags",
        Some(&json!({ "IDs": [welcome_id], "Tags": [] })),
    )
    .await;
    let (tags_status, tags) = call_api(&app_router, "GET", "/api/v1/tags", None).await;
    let (_, invoice) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/message/{invoice_id}"),
        None,
    )
    .await;

    assert_eq!((set_status, tags_status), (200, 200));
    assert_eq!(tags, json!(["billing", "qa"]));
    assert_eq!(invoice["Tags"], json!(["billing", "qa"]));
}
