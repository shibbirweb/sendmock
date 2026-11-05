#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use serde_json::json;
use support::email_provider_requests::{
    count_emails, read_addresses, read_newest_email, send_json, send_provider_request,
};
use support::test_app::build_test_app;

// AC: EM-08.1 EM-08.2
#[tokio::test]
async fn sendgrid_mail_send_stores_the_message_and_answers_202_with_x_message_id() {
    let (app_router, _) = build_test_app();
    let mail_send = json!({
        "personalizations": [{
            "to": [{"email": "sam@example.test", "name": "Sam"}],
            "cc": [{"email": "ops@example.test"}],
        }],
        "from": {"email": "shop@example.test", "name": "Shop"},
        "subject": "Your order",
        "content": [
            {"type": "text/plain", "value": "Order 1001 is on its way"},
            {"type": "text/html", "value": "<p>Order <b>1001</b> is on its way</p>"},
        ],
        "attachments": [{"content": "aGVsbG8=", "filename": "invoice.txt", "type": "text/plain"}],
    });

    let reply = send_json(&app_router, "/providers/sendgrid/v3/mail/send", &mail_send).await;

    assert_eq!(reply.status, 202, "{}", reply.body_text);
    assert_eq!(reply.body_text, "");
    assert_eq!(reply.header("x-message-id").map(str::len), Some(22));
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["source"], "sendgrid");
    assert_eq!(email["subject"], "Your order");
    assert_eq!(email["from"]["address"], "shop@example.test");
    assert_eq!(read_addresses(&email["to"]), vec!["sam@example.test"]);
    assert_eq!(read_addresses(&email["cc"]), vec!["ops@example.test"]);
    assert_eq!(email["attachment_count"], 1);
}

// AC: EM-08.3
#[tokio::test]
async fn sendgrid_refuses_a_missing_recipient_and_an_invalid_address_in_its_error_shape() {
    let (app_router, _) = build_test_app();
    let without_recipient = json!({
        "personalizations": [{"to": []}],
        "from": {"email": "shop@example.test"},
        "subject": "Hi",
        "content": [{"type": "text/plain", "value": "Hi"}],
    });
    let invalid_sender = json!({
        "personalizations": [{"to": [{"email": "sam@example.test"}]}],
        "from": {"email": "not-an-address"},
        "subject": "Hi",
        "content": [{"type": "text/plain", "value": "Hi"}],
    });

    let missing = send_json(
        &app_router,
        "/providers/sendgrid/v3/mail/send",
        &without_recipient,
    )
    .await;
    let invalid = send_json(
        &app_router,
        "/providers/sendgrid/v3/mail/send",
        &invalid_sender,
    )
    .await;

    assert_eq!(missing.status, 400, "{}", missing.body_text);
    assert_eq!(missing.body["errors"][0]["field"], "to");
    assert_eq!(invalid.status, 400, "{}", invalid.body_text);
    assert_eq!(
        invalid.body["errors"][0]["message"],
        "Does not contain a valid address."
    );
    assert_eq!(count_emails(&app_router).await, 0);
}

// AC: EM-08.1 EM-08.2
#[tokio::test]
async fn mailgun_messages_read_a_multipart_form_with_tags_headers_and_a_file() {
    let (app_router, _) = build_test_app();
    let boundary = "mailgun-boundary";
    let mut form_body = String::new();
    for (field_name, field_value) in [
        ("from", "Shop <shop@mg.example.test>"),
        ("to", "sam@example.test, \"Doe, Jane\" <jane@example.test>"),
        ("subject", "Welcome"),
        ("text", "Hello from Mailgun"),
        ("o:tag", "welcome"),
        ("h:X-Campaign", "spring"),
    ] {
        form_body.push_str(&format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"{field_name}\"\r\n\r\n{field_value}\r\n"
        ));
    }
    form_body.push_str(&format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"attachment\"; filename=\"note.txt\"\r\nContent-Type: text/plain\r\n\r\nattached\r\n--{boundary}--\r\n"
    ));

    let reply = send_provider_request(
        &app_router,
        "/providers/mailgun/v3/mg.example.test/messages",
        &format!("multipart/form-data; boundary={boundary}"),
        form_body.into_bytes(),
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body["message"], "Queued. Thank you.");
    assert!(
        reply.body["id"]
            .as_str()
            .is_some_and(|message_id| message_id.ends_with("@mg.example.test>"))
    );
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["source"], "mailgun");
    assert_eq!(
        read_addresses(&email["to"]),
        vec!["sam@example.test", "jane@example.test"]
    );
    assert!(
        email["tags"]
            .as_array()
            .is_some_and(|tags| tags.contains(&json!("welcome")))
    );
    assert_eq!(email["attachment_count"], 1);
}

// AC: EM-08.1 EM-08.2 EM-08.3
#[tokio::test]
async fn postmark_email_answers_its_receipt_and_refuses_a_missing_sender_with_422() {
    let (app_router, _) = build_test_app();
    let postmark_email = json!({
        "From": "shop@example.test",
        "To": "sam@example.test, ops@example.test",
        "Subject": "Receipt",
        "HtmlBody": "<p>Thanks</p>",
        "Attachments": [{"Name": "receipt.txt", "Content": "dGhhbmtz", "ContentType": "text/plain"}],
        "MessageStream": "outbound",
    });

    let reply = send_json(&app_router, "/providers/postmark/email", &postmark_email).await;
    let missing_sender = send_json(
        &app_router,
        "/providers/postmark/email",
        &json!({"To": "sam@example.test", "Subject": "Hi", "TextBody": "Hi"}),
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body["ErrorCode"], 0);
    assert_eq!(reply.body["Message"], "OK");
    assert_eq!(reply.body["To"], "sam@example.test, ops@example.test");
    assert_eq!(reply.body["MessageID"].as_str().map(str::len), Some(36));
    assert_eq!(missing_sender.status, 422, "{}", missing_sender.body_text);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["source"], "postmark");
    assert_eq!(email["attachment_count"], 1);
}

// AC: EM-08.1 EM-08.2 EM-08.3
#[tokio::test]
async fn resend_emails_answer_an_id_and_need_a_subject() {
    let (app_router, _) = build_test_app();
    let resend_email = json!({
        "from": "Shop <shop@example.test>",
        "to": ["sam@example.test"],
        "subject": "Hello",
        "html": "<p>Hello</p>",
        "reply_to": "support@example.test",
    });

    let reply = send_json(&app_router, "/providers/resend/emails", &resend_email).await;
    let without_subject = send_json(
        &app_router,
        "/providers/resend/emails",
        &json!({"from": "shop@example.test", "to": ["sam@example.test"], "html": "<p>Hi</p>"}),
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body["id"].as_str().map(str::len), Some(36));
    assert_eq!(without_subject.status, 422, "{}", without_subject.body_text);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["source"], "resend");
    assert_eq!(
        read_addresses(&email["reply_to"]),
        vec!["support@example.test"]
    );
}

// AC: EM-08.1 EM-08.2
#[tokio::test]
async fn ses_v2_and_brevo_sends_answer_their_message_ids() {
    let (app_router, _) = build_test_app();
    let ses_email = json!({
        "FromEmailAddress": "shop@example.test",
        "Destination": {"ToAddresses": ["sam@example.test"], "CcAddresses": ["ops@example.test"]},
        "Content": {"Simple": {
            "Subject": {"Data": "SES hello"},
            "Body": {"Text": {"Data": "Hi from SES"}},
        }},
    });
    let brevo_email = json!({
        "sender": {"email": "shop@example.test", "name": "Shop"},
        "to": [{"email": "sam@example.test"}],
        "subject": "Brevo hello",
        "htmlContent": "<p>Hi from Brevo</p>",
        "tags": ["welcome"],
    });

    let ses_reply = send_json(
        &app_router,
        "/providers/ses/v2/email/outbound-emails",
        &ses_email,
    )
    .await;
    let brevo_reply = send_json(&app_router, "/providers/brevo/v3/smtp/email", &brevo_email).await;

    assert_eq!(ses_reply.status, 200, "{}", ses_reply.body_text);
    assert!(
        ses_reply.body["MessageId"]
            .as_str()
            .is_some_and(|message_id| message_id.starts_with("0100"))
    );
    assert_eq!(brevo_reply.status, 201, "{}", brevo_reply.body_text);
    assert!(
        brevo_reply.body["messageId"]
            .as_str()
            .is_some_and(|message_id| message_id.ends_with("@smtp-relay.mailin.fr>"))
    );
    let brevo_email = read_newest_email(&app_router).await;
    assert_eq!(brevo_email["source"], "brevo");
    assert_eq!(brevo_email["subject"], "Brevo hello");
    assert_eq!(count_emails(&app_router).await, 2);
}

// AC: EM-08.1
#[tokio::test]
async fn the_provider_port_answers_email_providers_at_their_real_paths() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    let resend_email = json!({
        "from": "shop@example.test",
        "to": ["sam@example.test"],
        "subject": "Through the provider port",
        "text": "Hi",
    });

    let reply = send_json(&provider_port_router, "/emails", &resend_email).await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["subject"], "Through the provider port");
    assert_eq!(email["source"], "resend");
}

// AC: EM-08.1
#[tokio::test]
async fn ses_v2_raw_content_is_stored_as_sent_with_the_sender_and_recipients_from_its_headers() {
    use base64::Engine;
    let (app_router, _) = build_test_app();
    let raw_message = "From: Shop <shop@example.test>\r\nTo: sam@example.test\r\nSubject: Raw from SES\r\nMessage-ID: <raw-1@shop.test>\r\nContent-Type: text/html\r\n\r\n<p>Your order shipped</p>";
    let ses_raw_email = json!({
        "Destination": {"BccAddresses": ["audit@example.test"]},
        "Content": {"Raw": {"Data": base64::engine::general_purpose::STANDARD.encode(raw_message)}},
    });
    let not_base64 = json!({
        "FromEmailAddress": "shop@example.test",
        "Destination": {"ToAddresses": ["sam@example.test"]},
        "Content": {"Raw": {"Data": "not base64!"}},
    });

    let reply = send_json(
        &app_router,
        "/providers/ses/v2/email/outbound-emails",
        &ses_raw_email,
    )
    .await;
    let refused = send_json(
        &app_router,
        "/providers/ses/v2/email/outbound-emails",
        &not_base64,
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["source"], "ses");
    assert_eq!(email["subject"], "Raw from SES");
    assert_eq!(email["from"]["address"], "shop@example.test");
    assert_eq!(email["message_id"], "raw-1@shop.test");
    assert_eq!(email["html_body"], "<p>Your order shipped</p>");
    assert_eq!(read_addresses(&email["bcc"]), vec!["audit@example.test"]);
    assert_eq!(refused.status, 400, "{}", refused.body_text);
    assert_eq!(count_emails(&app_router).await, 1);
}
