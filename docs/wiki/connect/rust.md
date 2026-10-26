---
title: Rust
description: Connect Rust apps to SendMock with lettre and reqwest.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

```rust
let mailer = SmtpTransport::builder_dangerous("127.0.0.1").port(1025).build();
mailer.send(&message)?;
```

## SMS

```rust
reqwest::Client::new()
    .post("http://127.0.0.1:8025/api/v1/sms")
    .json(&serde_json::json!({
        "from": "+15550001111",
        "to": "+8801700000000",
        "body": "Your code is 482913"
    }))
    .send()
    .await?;
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.

## Test helper

Save this as `tests/sendmock/mod.rs`. The code examples in the [recipes](../recipes/index.md) use it to call SendMock and your app.

```rust title="tests/sendmock/mod.rs"
use serde_json::Value;

pub const SENDMOCK: &str = "http://127.0.0.1:8025/api/v1";
pub const APP: &str = "http://localhost:8080";

/// Calls SendMock or your app and returns the JSON answer, or `Value::Null` when there is none.
pub async fn call(method: &str, url: &str, body: Option<Value>) -> Value {
    let method = reqwest::Method::from_bytes(method.as_bytes()).expect("an HTTP method");
    let mut request = reqwest::Client::new().request(method, url);
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request
        .send()
        .await
        .expect("the request is sent")
        .error_for_status()
        .expect("a success status");
    let is_json = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .map_or(false, |value| value.contains("json"));
    if is_json {
        response.json().await.expect("a JSON answer")
    } else {
        Value::Null
    }
}
```
