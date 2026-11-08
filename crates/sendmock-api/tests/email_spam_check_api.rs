#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use sendmock_ops::{SpamChecker, SpamdReport, SpamdRule};
use serde_json::json;
use support::email_provider_requests::{read_newest_email, send_json};
use support::test_app::{build_test_app, build_test_app_with, call_api};

/// Answers like a spamd that scores every message 6.3 and remembers what it was sent.
#[derive(Default)]
struct FakeSpamChecker {
    received_requests: Mutex<Vec<(String, String)>>,
}

impl FakeSpamChecker {
    fn read_received_requests(&self) -> Vec<(String, String)> {
        self.received_requests
            .lock()
            .map(|received_requests| received_requests.clone())
            .unwrap_or_default()
    }
}

impl SpamChecker for FakeSpamChecker {
    fn request_spam_report<'checker>(
        &'checker self,
        spamd_address: &'checker str,
        raw_message: &'checker [u8],
    ) -> Pin<Box<dyn Future<Output = Result<SpamdReport, String>> + Send + 'checker>> {
        if let Ok(mut received_requests) = self.received_requests.lock() {
            received_requests.push((
                spamd_address.to_owned(),
                String::from_utf8_lossy(raw_message).into_owned(),
            ));
        }
        Box::pin(async move {
            if spamd_address == "127.0.0.1:1" {
                return Err("connection refused".to_owned());
            }
            Ok(SpamdReport {
                score: 6.3,
                threshold: 5.0,
                rules: vec![SpamdRule {
                    name: "SUBJ_ALL_CAPS".to_owned(),
                    score: 6.3,
                    description: "Subject is all capitals".to_owned(),
                }],
            })
        })
    }
}

async fn send_shouting_email(app_router: &axum::Router) -> String {
    let mail_send = json!({
        "personalizations": [{"to": [{"email": "sam@example.test"}]}],
        "from": {"email": "shop@example.test"},
        "subject": "LAST CHANCE",
        "content": [{"type": "text/plain", "value": "Everything must go"}],
    });
    let reply = send_json(app_router, "/providers/sendgrid/v3/mail/send", &mail_send).await;
    assert_eq!(reply.status, 202, "{}", reply.body_text);
    let email = read_newest_email(app_router).await;
    email["id"].as_str().unwrap_or_default().to_owned()
}

async fn set_spamassassin_address(app_router: &axum::Router, spamd_address: &str) {
    let (status, settings) = call_api(
        app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "spamassassin_address": spamd_address })),
    )
    .await;
    assert_eq!(status, 200, "{settings}");
}

// AC: EM-13.3
#[tokio::test]
async fn with_a_spamassassin_address_the_raw_message_is_scored_with_its_rules() {
    let spam_checker = Arc::new(FakeSpamChecker::default());
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_spam_checker(spam_checker.clone())
    });
    set_spamassassin_address(&app_router, "127.0.0.1:783").await;
    let email_id = send_shouting_email(&app_router).await;

    let (status, report) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/spam-check"),
        None,
    )
    .await;

    assert_eq!(status, 200, "{report}");
    assert_eq!(report["is_available"], true);
    assert_eq!(report["score"], 6.3);
    assert_eq!(report["threshold"], 5.0);
    assert_eq!(report["rules"][0]["name"], "SUBJ_ALL_CAPS");
    let received_requests = spam_checker.read_received_requests();
    assert_eq!(received_requests.len(), 1);
    assert_eq!(received_requests[0].0, "127.0.0.1:783");
    assert!(
        received_requests[0].1.contains("LAST CHANCE"),
        "{received_requests:?}"
    );
}

// AC: EM-13.3
#[tokio::test]
async fn without_a_spamassassin_address_the_check_is_not_available() {
    let spam_checker = Arc::new(FakeSpamChecker::default());
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_spam_checker(spam_checker.clone())
    });
    let email_id = send_shouting_email(&app_router).await;

    let (status, report) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/spam-check"),
        None,
    )
    .await;

    assert_eq!(status, 200, "{report}");
    assert_eq!(report["is_available"], false);
    assert_eq!(report["score"], serde_json::Value::Null);
    assert_eq!(report["rules"], json!([]));
    assert!(spam_checker.read_received_requests().is_empty());
}

#[tokio::test]
async fn a_spamd_that_does_not_answer_is_reported_as_an_upstream_error() {
    let spam_checker = Arc::new(FakeSpamChecker::default());
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_spam_checker(spam_checker.clone())
    });
    set_spamassassin_address(&app_router, "127.0.0.1:1").await;
    let email_id = send_shouting_email(&app_router).await;

    let (status, refused) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/spam-check"),
        None,
    )
    .await;

    assert_eq!(status, 502, "{refused}");
    assert_eq!(refused["error"]["code"], "spamassassin_unavailable");
}

#[tokio::test]
async fn a_build_without_a_spamd_client_reports_the_check_as_not_available() {
    let (app_router, _) = build_test_app();
    set_spamassassin_address(&app_router, "127.0.0.1:783").await;
    let email_id = send_shouting_email(&app_router).await;

    let (_, report) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/spam-check"),
        None,
    )
    .await;

    assert_eq!(report["is_available"], false);
}
