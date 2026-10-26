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

## Test helper

Save this as `SendMock.cs`. The code examples in the [recipes](../recipes/index.md) use it to call SendMock and your app.

```csharp title="SendMock.cs"
using System.Net.Http.Json;
using System.Text.Json;

public static class SendMock
{
    public const string Sendmock = "http://127.0.0.1:8025/api/v1";
    public const string App = "http://localhost:5000";
    private static readonly HttpClient Http = new();

    /// <summary>Calls SendMock or your app; returns the JSON answer, or an undefined element when there is none.</summary>
    public static async Task<JsonElement> Call(string method, string url, object? body = null)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        using var response = await Http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentType?.MediaType?.Contains("json") != true)
        {
            return default;
        }

        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
```
