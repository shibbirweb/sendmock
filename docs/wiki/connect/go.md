---
title: Go
description: Connect Go apps to SendMock with net/smtp and net/http.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

```go
err := smtp.SendMail("127.0.0.1:1025", nil, from, []string{to}, message)
```

## SMS

```go
payload := strings.NewReader(`{"from":"+15550001111","to":"+8801700000000","body":"Your code is 482913"}`)
resp, err := http.Post("http://127.0.0.1:8025/api/v1/sms", "application/json", payload)
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms.md) and [Email](../email.md) pages list the providers.
