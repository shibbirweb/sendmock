//! An app's test on reqwest: it sends an email and reads its code, sends an SMS and waits for
//! it, and captures an outgoing HTTP call, all against a running SendMock.

use std::process::exit;
use std::time::Duration;

use serde_json::{Value, json};

fn sendmock_url() -> String {
    std::env::var("SENDMOCK_URL").unwrap_or_else(|_| "http://127.0.0.1:8025".to_owned())
}

fn fail(message: &str) -> ! {
    eprintln!("{message}");
    exit(1)
}

fn call(http_client: &reqwest::blocking::Client, method: &str, path: &str, body: Option<Value>) -> Value {
    let url = format!("{}{path}", sendmock_url());
    let request = match body {
        Some(body) => http_client.request(method.parse().unwrap_or(reqwest::Method::POST), &url).json(&body),
        None => http_client.get(&url),
    };
    let response = request.send().unwrap_or_else(|send_error| fail(&format!("{method} {path} failed: {send_error}")));
    let status = response.status();
    let answer_text = response.text().unwrap_or_default();
    if !status.is_success() {
        fail(&format!("{method} {path} answered {status}: {answer_text}"));
    }
    serde_json::from_str(&answer_text).unwrap_or(Value::Null)
}

fn expect_equal(actual: &Value, expected: &Value, what: &str) {
    if actual != expected {
        fail(&format!("{what}: expected {expected}, got {actual}"));
    }
}

fn main() {
    let http_client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap_or_else(|build_error| fail(&format!("no HTTP client: {build_error}")));

    call(&http_client, "POST", "/api/v1/send", Some(json!({ "from": "app@shop.test", "to": ["rust@example.test"], "subject": "Your code", "text": "Your code is 482913" })));
    let otp = call(&http_client, "GET", "/api/v1/otp?to=rust%40example.test&timeout=10s", None);
    expect_equal(&otp["code"], &json!("482913"), "The code in the email");

    call(&http_client, "POST", "/api/v1/sms", Some(json!({ "from": "+15550001111", "to": "+15550002222", "body": "Hello from Rust" })));
    let sms = call(&http_client, "GET", "/api/v1/wait/sms?to=%2B15550002222&timeout=10s", None);
    expect_equal(&sms["body"], &json!("Hello from Rust"), "The SMS body");

    call(&http_client, "POST", "/catch/rust-orders/orders", Some(json!({ "order": 42 })));
    let captured = call(&http_client, "GET", "/api/v1/wait/http?bin=rust-orders&timeout=10s", None);
    expect_equal(&captured["method"], &json!("POST"), "The captured request's method");
    expect_equal(&captured["body"], &json!("{\"order\":42}"), "The captured body");

    println!("Rust: email, SMS and HTTP capture all work.");
}
