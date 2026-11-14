// An app's test on .NET's own HttpClient: it sends an email and reads its code, sends an SMS and
// waits for it, and captures an outgoing HTTP call, all against a running SendMock.
using System.Net.Http.Json;
using System.Text.Json;

var sendmockUrl = Environment.GetEnvironmentVariable("SENDMOCK_URL") ?? "http://127.0.0.1:8025";
using var httpClient = new HttpClient { BaseAddress = new Uri(sendmockUrl), Timeout = TimeSpan.FromSeconds(30) };

async Task<JsonElement> Call(HttpMethod method, string path, object? body = null)
{
    using var request = new HttpRequestMessage(method, path);
    if (body is not null)
    {
        request.Content = JsonContent.Create(body);
    }
    using var response = await httpClient.SendAsync(request);
    var answerText = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode)
    {
        Fail($"{method} {path} answered {(int)response.StatusCode}: {answerText}");
    }
    return JsonDocument.Parse(answerText).RootElement.Clone();
}

void Fail(string message)
{
    Console.Error.WriteLine(message);
    Environment.Exit(1);
}

void ExpectEqual(string? actual, string expected, string what)
{
    if (actual != expected)
    {
        Fail($"{what}: expected {expected}, got {actual}");
    }
}

await Call(HttpMethod.Post, "/api/v1/send", new { from = "app@shop.test", to = new[] { "dotnet@example.test" }, subject = "Your code", text = "Your code is 482913" });
var otp = await Call(HttpMethod.Get, "/api/v1/otp?to=dotnet%40example.test&timeout=10s");
ExpectEqual(otp.GetProperty("code").GetString(), "482913", "The code in the email");

await Call(HttpMethod.Post, "/api/v1/sms", new { from = "+15550001111", to = "+15550002222", body = "Hello from .NET" });
var sms = await Call(HttpMethod.Get, "/api/v1/wait/sms?to=%2B15550002222&timeout=10s");
ExpectEqual(sms.GetProperty("body").GetString(), "Hello from .NET", "The SMS body");

await Call(HttpMethod.Post, "/catch/dotnet-orders/orders", new { order = 42 });
var captured = await Call(HttpMethod.Get, "/api/v1/wait/http?bin=dotnet-orders&timeout=10s");
ExpectEqual(captured.GetProperty("method").GetString(), "POST", "The captured request's method");
ExpectEqual(captured.GetProperty("body").GetString(), "{\"order\":42}", "The captured body");

Console.WriteLine(".NET: email, SMS and HTTP capture all work.");
