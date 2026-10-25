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

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms.md) and [Email](../email.md) pages list the providers.
