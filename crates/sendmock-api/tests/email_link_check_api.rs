#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use sendmock_ops::{LinkChecker, LinkProbe};
use serde_json::{Value, json};
use support::email_provider_requests::{read_newest_email, send_json};
use support::test_app::{build_test_app, build_test_app_with, call_api};

const SHOP_HTML: &str = r#"<p><a href="https://shop.example.test/orders/1001">Your order</a>
<a href="https://shop.example.test/old">Old page</a>
<a href="https://slow.example.test/track">Track</a></p>
<img src="https://cdn.example.test/logo.png" alt="Shop">"#;

/// Answers from a fixed table and remembers every URL it was asked for.
#[derive(Default)]
struct FakeLinkChecker {
    probed_urls: Mutex<Vec<String>>,
}

impl FakeLinkChecker {
    fn read_probed_urls(&self) -> Vec<String> {
        self.probed_urls
            .lock()
            .map(|probed_urls| probed_urls.clone())
            .unwrap_or_default()
    }
}

fn build_fake_probe(link_url: &str) -> LinkProbe {
    let answered = |status_code: u16, redirect_url: Option<&str>| LinkProbe {
        status_code: Some(status_code),
        redirect_url: redirect_url.map(str::to_owned),
        duration_ms: Some(12),
        error_message: None,
    };
    match link_url {
        "https://shop.example.test/old" => answered(301, Some("https://shop.example.test/new")),
        "https://slow.example.test/track" => LinkProbe {
            status_code: None,
            redirect_url: None,
            duration_ms: Some(10_000),
            error_message: Some("Timed out".to_owned()),
        },
        _ => answered(200, None),
    }
}

impl LinkChecker for FakeLinkChecker {
    fn probe_link<'checker>(
        &'checker self,
        link_url: &'checker str,
    ) -> Pin<Box<dyn Future<Output = LinkProbe> + Send + 'checker>> {
        if let Ok(mut probed_urls) = self.probed_urls.lock() {
            probed_urls.push(link_url.to_owned());
        }
        Box::pin(async move { build_fake_probe(link_url) })
    }
}

async fn send_shop_email(app_router: &axum::Router) -> String {
    let mail_send = json!({
        "personalizations": [{"to": [{"email": "sam@example.test"}]}],
        "from": {"email": "shop@example.test"},
        "subject": "Your order",
        "content": [{"type": "text/html", "value": SHOP_HTML}],
    });
    let reply = send_json(app_router, "/providers/sendgrid/v3/mail/send", &mail_send).await;
    assert_eq!(reply.status, 202, "{}", reply.body_text);
    let email = read_newest_email(app_router).await;
    email["id"].as_str().unwrap_or_default().to_owned()
}

fn find_result<'results>(results: &'results Value, link_url: &str) -> &'results Value {
    results
        .as_array()
        .and_then(|results| results.iter().find(|result| result["url"] == link_url))
        .unwrap_or(&Value::Null)
}

// AC: EM-13.2
#[tokio::test]
async fn the_link_check_reports_status_redirects_and_timeouts_for_links_and_images() {
    let link_checker = Arc::new(FakeLinkChecker::default());
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_link_checker(link_checker.clone())
    });
    let email_id = send_shop_email(&app_router).await;

    let (status, results) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/link-check"),
        None,
    )
    .await;

    assert_eq!(status, 200, "{results}");
    assert_eq!(results.as_array().map(Vec::len), Some(4), "{results}");
    let order_link = find_result(&results, "https://shop.example.test/orders/1001");
    assert_eq!(order_link["kind"], "link");
    assert_eq!(order_link["status_code"], 200);
    let old_link = find_result(&results, "https://shop.example.test/old");
    assert_eq!(old_link["status_code"], 301);
    assert_eq!(old_link["redirect_url"], "https://shop.example.test/new");
    let slow_link = find_result(&results, "https://slow.example.test/track");
    assert_eq!(slow_link["status_code"], Value::Null);
    assert_eq!(slow_link["error_message"], "Timed out");
    let logo = find_result(&results, "https://cdn.example.test/logo.png");
    assert_eq!(logo["kind"], "image");
    assert_eq!(logo["status_code"], 200);
}

// AC: EM-13.2
#[tokio::test]
async fn links_are_requested_only_when_the_check_is_asked_for() {
    let link_checker = Arc::new(FakeLinkChecker::default());
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_link_checker(link_checker.clone())
    });

    let email_id = send_shop_email(&app_router).await;
    call_api(
        &app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await;
    call_api(
        &app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}/html-check"),
        None,
    )
    .await;

    assert_eq!(link_checker.read_probed_urls(), Vec::<String>::new());
}

// AC: EM-13.2
#[tokio::test]
async fn without_a_link_checker_each_link_says_the_check_is_not_available() {
    let (app_router, _) = build_test_app();
    let email_id = send_shop_email(&app_router).await;

    let (status, results) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/link-check"),
        None,
    )
    .await;

    assert_eq!(status, 200, "{results}");
    let order_link = find_result(&results, "https://shop.example.test/orders/1001");
    assert_eq!(
        order_link["error_message"],
        "Link checks are not available in this build"
    );
}
