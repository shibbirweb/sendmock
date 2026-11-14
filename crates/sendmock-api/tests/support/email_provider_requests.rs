use axum::body::Body;
use axum::http::Request;
use serde_json::Value;
use tower::ServiceExt;

use super::test_app::call_api;

/// A provider's answer: the status, the headers and the body as text and as JSON.
pub struct ProviderReply {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body_text: String,
    pub body: Value,
}

impl ProviderReply {
    pub fn header(&self, header_name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(sent_name, _)| sent_name.eq_ignore_ascii_case(header_name))
            .map(|(_, header_value)| header_value.as_str())
    }
}

/// Sends a request as a provider SDK does, with the given content type and body.
pub async fn send_provider_request(
    router: &axum::Router,
    path: &str,
    content_type: &str,
    body: Vec<u8>,
) -> ProviderReply {
    let request = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", content_type)
        .header("authorization", "Bearer test-key")
        .body(Body::from(body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .map(|(header_name, header_value)| {
            (
                header_name.to_string(),
                header_value.to_str().unwrap_or_default().to_owned(),
            )
        })
        .collect();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    ProviderReply {
        status,
        headers,
        body_text: String::from_utf8_lossy(&body_bytes).into_owned(),
        body: serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    }
}

pub async fn send_json(router: &axum::Router, path: &str, request_body: &Value) -> ProviderReply {
    send_provider_request(
        router,
        path,
        "application/json",
        request_body.to_string().into_bytes(),
    )
    .await
}

/// The newest stored email's detail.
pub async fn read_newest_email(app_router: &axum::Router) -> Value {
    let (_, emails) = call_api(app_router, "GET", "/api/v1/emails", None).await;
    let email_id = emails["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let (_, email) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await;
    email
}

pub async fn count_emails(app_router: &axum::Router) -> usize {
    let (_, emails) = call_api(app_router, "GET", "/api/v1/emails", None).await;
    emails["items"].as_array().map_or(0, Vec::len)
}

pub fn read_addresses(address_list: &Value) -> Vec<String> {
    address_list
        .as_array()
        .map(|addresses| {
            addresses
                .iter()
                .filter_map(|address| address["address"].as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}
