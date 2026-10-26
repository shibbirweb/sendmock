---
title: .NET
description: Connect .NET apps to SendMock with mailKit, SmtpClient and HttpClient.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

```csharp
using var smtp = new MailKit.Net.Smtp.SmtpClient();
await smtp.ConnectAsync("127.0.0.1", 1025, MailKit.Security.SecureSocketOptions.None);
await smtp.SendAsync(message);
```

## SMS

```csharp
using var http = new HttpClient();
await http.PostAsJsonAsync("http://127.0.0.1:8025/api/v1/sms", new {
    from = "+15550001111",
    to = "+8801700000000",
    body = "Your code is 482913",
});
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.
