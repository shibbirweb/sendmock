#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::{FetchedMedia, MediaFetcher};
use serde_json::Value;
use support::test_app::{build_test_app, build_test_app_with, call_api};
use tower::ServiceExt;

const MESSAGES_PATH: &str =
    "/providers/twilio/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages";
/// `ACtest...:any-token`, as an SDK configured with any credentials sends it.
const ANY_BASIC_AUTH: &str = "Basic QUN0ZXN0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6YW55LXRva2Vu";

async fn call_twilio(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/x-www-form-urlencoded")
        .header("authorization", ANY_BASIC_AUTH)
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
    let body_text = String::from_utf8_lossy(&body_bytes).into_owned();
    (
        status,
        serde_json::from_str(&body_text)
            .unwrap_or_else(|error| panic!("JSON, not {body_text}: {error}")),
    )
}

async fn send_twilio(app_router: &axum::Router, form_body: &str) -> (u16, Value) {
    call_twilio(
        app_router,
        "POST",
        &format!("{MESSAGES_PATH}.json"),
        form_body,
    )
    .await
}

fn is_twilio_message_sid(sid: &Value) -> bool {
    sid.as_str().is_some_and(|sid| {
        sid.len() == 34
            && sid.starts_with("SM")
            && sid[2..]
                .chars()
                .all(|character| character.is_ascii_hexdigit())
    })
}

// AC: SM-02.1
#[tokio::test]
async fn create_fetch_and_list_answer_twilio_shaped_messages() {
    let (app_router, _) = build_test_app();

    let (create_status, created_message) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550006&Body=Your+code+is+482913",
    )
    .await;
    let message_sid = created_message["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let (fetch_status, fetched_message) = call_twilio(
        &app_router,
        "GET",
        &format!("{MESSAGES_PATH}/{message_sid}.json"),
        "",
    )
    .await;
    let (list_status, message_page) = call_twilio(
        &app_router,
        "GET",
        &format!("{MESSAGES_PATH}.json?To=%2B8801700000000"),
        "",
    )
    .await;
    let (_, stored_messages) = call_api(&app_router, "GET", "/api/v1/sms", None).await;

    assert_eq!(create_status, 201);
    assert!(
        is_twilio_message_sid(&created_message["sid"]),
        "{created_message}"
    );
    assert_eq!(created_message["status"], "queued");
    assert_eq!(
        created_message["account_sid"],
        "ACtest00000000000000000000000000"
    );
    assert_eq!(created_message["to"], "+8801700000000");
    assert_eq!(created_message["num_segments"], "1");
    assert_eq!(created_message["error_code"], Value::Null);
    assert_eq!(fetch_status, 200);
    assert_eq!(fetched_message["sid"], created_message["sid"]);
    assert_eq!(list_status, 200);
    assert_eq!(message_page["messages"][0]["sid"], created_message["sid"]);
    assert_eq!(message_page["page_size"], 50);
    assert_eq!(stored_messages["items"][0]["api"], "twilio");
    assert_eq!(
        stored_messages["items"][0]["provider_id"],
        created_message["sid"]
    );
}

// AC: SM-02.1
#[tokio::test]
async fn a_body_with_quotes_keeps_the_answer_valid_json() {
    let (app_router, _) = build_test_app();

    let (status, created_message) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550006&Body=Say+%22hi%22%0Anow",
    )
    .await;

    assert_eq!(status, 201);
    assert_eq!(created_message["body"], "Say \"hi\"\nnow");
}

// AC: SM-02.2
#[tokio::test]
async fn missing_and_invalid_params_get_twilios_error_json() {
    let (app_router, _) = build_test_app();
    let cases = [
        (
            "From=%2B15005550006&Body=Hi",
            21604,
            "A 'To' phone number is required.",
        ),
        (
            "To=12345&From=%2B15005550006&Body=Hi",
            21211,
            "The 'To' number is not a valid phone number.",
        ),
        (
            "To=%2B8801700000000&Body=Hi",
            21603,
            "A 'From' phone number is required.",
        ),
        (
            "To=%2B8801700000000&From=%2B15005550006",
            21602,
            "Message body is required.",
        ),
    ];

    for (form_body, expected_code, expected_message) in cases {
        let (status, error_body) = send_twilio(&app_router, form_body).await;
        assert_eq!(status, 400, "{form_body}");
        assert_eq!(error_body["code"], expected_code, "{form_body}");
        assert_eq!(error_body["message"], expected_message, "{form_body}");
        assert_eq!(error_body["status"], 400);
        assert_eq!(
            error_body["more_info"],
            format!("https://www.twilio.com/docs/errors/{expected_code}")
        );
    }
}

// AC: SM-02.2
// AC: SM-07.2
#[tokio::test]
async fn magic_numbers_answer_twilios_codes_and_an_unknown_sid_is_not_found() {
    let (app_router, _) = build_test_app();

    let (to_status, to_error) =
        send_twilio(&app_router, "To=%2B15005550001&From=%2B15005550006&Body=Hi").await;
    let (from_status, from_error) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550008&Body=Hi",
    )
    .await;
    let (missing_status, missing_error) = call_twilio(
        &app_router,
        "GET",
        &format!("{MESSAGES_PATH}/SM00000000000000000000000000000000.json"),
        "",
    )
    .await;

    assert_eq!(
        (to_status, to_error["code"].clone()),
        (400, Value::from(21211))
    );
    assert_eq!(to_error["message"], "Invalid number");
    assert_eq!(
        (from_status, from_error["code"].clone()),
        (400, Value::from(21611))
    );
    assert_eq!(
        (missing_status, missing_error["code"].clone()),
        (404, Value::from(20404))
    );
}

// AC: SM-02.3
#[tokio::test]
async fn any_credentials_are_accepted_by_default() {
    let (app_router, _) = build_test_app();

    let (status, _) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550006&Body=Hi",
    )
    .await;

    assert_eq!(status, 201);
}

// AC: SM-13.1
// AC: SM-13.2
#[tokio::test]
async fn provider_requests_are_logged_with_the_exact_response_and_masked_credentials() {
    let (app_router, _) = build_test_app();
    let (_, created_message) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550006&Body=Hi",
    )
    .await;
    let (_, rejected_error) = send_twilio(&app_router, "From=%2B15005550006&Body=Hi").await;

    let (_, logged_page) = call_api(&app_router, "GET", "/api/v1/logs/http?api=twilio", None).await;
    let (_, stored_messages) = call_api(&app_router, "GET", "/api/v1/sms", None).await;

    let find_entry = |response_status: u16| {
        logged_page["items"]
            .as_array()
            .and_then(|entries| {
                entries
                    .iter()
                    .find(|entry| entry["response_status"] == response_status)
            })
            .cloned()
            .unwrap_or(Value::Null)
    };
    let (rejected_entry, accepted_entry) = (&find_entry(400), &find_entry(201));
    assert_eq!(logged_page["total_count"], 2);
    assert_eq!(rejected_entry["response_status"], 400);
    assert_eq!(
        serde_json::from_str::<Value>(rejected_entry["response_body"].as_str().unwrap_or_default())
            .ok(),
        Some(rejected_error)
    );
    assert_eq!(accepted_entry["response_status"], 201);
    assert_eq!(accepted_entry["linked_message"]["kind"], "sms");
    assert_eq!(
        accepted_entry["linked_message"]["id"],
        stored_messages["items"][0]["id"]
    );
    assert_eq!(
        accepted_entry["request_headers"]["authorization"],
        "Basic ********"
    );
    assert!(
        accepted_entry["path"]
            .as_str()
            .is_some_and(|path| path.starts_with("/providers/twilio/"))
    );
    assert!(is_twilio_message_sid(&created_message["sid"]));
}

#[tokio::test]
async fn a_path_no_provider_answers_gets_sendmocks_own_404() {
    let (app_router, _) = build_test_app();

    let (unknown_provider_status, unknown_body) =
        call_twilio(&app_router, "POST", "/providers/nobody/v1/send", "").await;
    let (wrong_path_status, _) =
        call_twilio(&app_router, "DELETE", &format!("{MESSAGES_PATH}.json"), "").await;

    assert_eq!(unknown_provider_status, 404);
    assert_eq!(unknown_body["error"]["code"], "not_found");
    assert_eq!(wrong_path_status, 404);
}

/// Serves one image link; every other link fails, as an unreachable host does.
struct OneImageFetcher;

impl MediaFetcher for OneImageFetcher {
    fn fetch_media<'fetcher>(
        &'fetcher self,
        media_url: &'fetcher str,
        _maximum_bytes: usize,
    ) -> Pin<Box<dyn Future<Output = Result<FetchedMedia, String>> + Send + 'fetcher>> {
        Box::pin(async move {
            if media_url == "https://cdn.test/logo.png" {
                Ok(FetchedMedia {
                    content_type: Some("image/png".to_owned()),
                    bytes: vec![137, 80, 78, 71],
                })
            } else {
                Err("connection refused".to_owned())
            }
        })
    }
}

// AC: SM-15.1
#[tokio::test]
async fn media_urls_are_copied_and_an_unreachable_one_fails_with_11200() {
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_media_fetcher(Arc::new(OneImageFetcher))
    });

    let (_, mms) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550006&MediaUrl=https%3A%2F%2Fcdn.test%2Flogo.png",
    )
    .await;
    let (_, failed_mms) = send_twilio(
        &app_router,
        "To=%2B8801700000000&From=%2B15005550006&Body=Hi&MediaUrl=https%3A%2F%2Fdown.test%2Fa.png",
    )
    .await;

    assert_eq!(mms["num_media"], "1");
    assert_eq!(mms["status"], "queued");
    assert_eq!(failed_mms["status"], "failed");
    assert_eq!(failed_mms["error_code"], 11200);
}
