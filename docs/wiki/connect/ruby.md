---
title: Ruby
description: Connect Ruby apps to SendMock with rails Action Mailer and Net::HTTP.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

Rails `config/environments/development.rb`:

```ruby
config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = { address: "127.0.0.1", port: 1025 }
```

## SMS

```ruby
Net::HTTP.post(
  URI("http://127.0.0.1:8025/api/v1/sms"),
  { from: "+15550001111", to: "+8801700000000", body: "Your code is 482913" }.to_json,
  "content-type" => "application/json",
)
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.
