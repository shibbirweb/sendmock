// The official Twilio C# SDK against SendMock: an SMS with status callbacks to a local
// handler, then a Verify login with the code read from SendMock's API (SM-02.4).
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Twilio.Clients;
using Twilio.Http;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Rest.Verify.V2;
using Twilio.Rest.Verify.V2.Service;
using Twilio.Types;

const string RecipientNumber = "+14155550105";
string[] expectedStatuses = ["queued", "sent", "delivered"];
var callbackTimeout = TimeSpan.FromSeconds(60);

var providerUrl = Environment.GetEnvironmentVariable("SENDMOCK_PROVIDER_URL") ?? "http://127.0.0.1:8026";
var sendmockUrl = Environment.GetEnvironmentVariable("SENDMOCK_URL") ?? "http://127.0.0.1:8025";
var providerPortHttpClient = new System.Net.Http.HttpClient(
    new ProviderPortHandler(new Uri(providerUrl)) { InnerHandler = new HttpClientHandler() });
var client = new TwilioRestClient(
    "AC00000000000000000000000000000006",
    "any-auth-token",
    httpClient: new SystemNetHttpClient(providerPortHttpClient));

var receivedStatuses = new ConcurrentQueue<string>();
var callbackPort = FindFreePort();
using var callbackListener = new HttpListener();
callbackListener.Prefixes.Add($"http://127.0.0.1:{callbackPort}/");
callbackListener.Start();
_ = Task.Run(() => RecordStatusCallbacksAsync(callbackListener, receivedStatuses));

var message = await MessageResource.CreateAsync(
    new CreateMessageOptions(new PhoneNumber(RecipientNumber))
    {
        From = new PhoneNumber("+15005550006"),
        Body = "Your order has shipped",
        StatusCallback = new Uri($"http://127.0.0.1:{callbackPort}/status"),
    },
    client);
Console.WriteLine($"Sent {message.Sid} ({message.Status})");
await WaitForStatusesAsync(receivedStatuses, expectedStatuses, callbackTimeout);
Console.WriteLine($"Status callbacks: {string.Join(", ", receivedStatuses)}");
callbackListener.Stop();

var verifyService = await ServiceResource.CreateAsync(new CreateServiceOptions("C# shop"), client);
var verification = await VerificationResource.CreateAsync(
    new CreateVerificationOptions(verifyService.Sid, RecipientNumber, "sms"),
    client);
var verifyCode = await ReadVerifyCodeAsync(sendmockUrl, RecipientNumber);
var verificationCheck = await VerificationCheckResource.CreateAsync(
    new CreateVerificationCheckOptions(verifyService.Sid) { To = RecipientNumber, Code = verifyCode },
    client);
if (verificationCheck.Status != "approved")
{
    throw new InvalidOperationException($"Verify login ended {verificationCheck.Status}");
}
Console.WriteLine($"Verify login {verification.Sid} approved with {verifyCode}");

// HttpListener cannot bind port 0, so a free port is taken from the operating system first.
static int FindFreePort()
{
    var portFinder = new TcpListener(IPAddress.Loopback, 0);
    portFinder.Start();
    var freePort = ((IPEndPoint)portFinder.LocalEndpoint).Port;
    portFinder.Stop();
    return freePort;
}

static async Task RecordStatusCallbacksAsync(HttpListener callbackListener, ConcurrentQueue<string> receivedStatuses)
{
    while (callbackListener.IsListening)
    {
        HttpListenerContext callbackContext;
        try
        {
            callbackContext = await callbackListener.GetContextAsync();
        }
        catch (HttpListenerException)
        {
            return;
        }
        catch (ObjectDisposedException)
        {
            return;
        }
        using var bodyReader = new StreamReader(callbackContext.Request.InputStream);
        var callbackFields = System.Web.HttpUtility.ParseQueryString(await bodyReader.ReadToEndAsync());
        receivedStatuses.Enqueue(callbackFields["MessageStatus"] ?? "");
        callbackContext.Response.StatusCode = 204;
        callbackContext.Response.Close();
    }
}

static async Task WaitForStatusesAsync(
    ConcurrentQueue<string> receivedStatuses,
    string[] expectedStatuses,
    TimeSpan callbackTimeout)
{
    var deadline = DateTime.UtcNow + callbackTimeout;
    while (receivedStatuses.Count < expectedStatuses.Length)
    {
        if (DateTime.UtcNow > deadline)
        {
            throw new TimeoutException($"Callbacks so far: {string.Join(", ", receivedStatuses)}");
        }
        await Task.Delay(250);
    }
    if (!receivedStatuses.SequenceEqual(expectedStatuses))
    {
        throw new InvalidOperationException($"Callbacks out of order: {string.Join(", ", receivedStatuses)}");
    }
}

static async Task<string> ReadVerifyCodeAsync(string sendmockUrl, string phoneNumber)
{
    using var otpHttpClient = new System.Net.Http.HttpClient();
    var otpUrl = $"{sendmockUrl}/api/v1/otp?to={Uri.EscapeDataString(phoneNumber)}&channel=verify";
    using var otpResponse = await otpHttpClient.GetAsync(otpUrl);
    otpResponse.EnsureSuccessStatusCode();
    using var otpBody = JsonDocument.Parse(await otpResponse.Content.ReadAsStringAsync());
    if (!otpBody.RootElement.TryGetProperty("code", out var codeField))
    {
        throw new InvalidOperationException($"No Verify code for {phoneNumber}");
    }
    return codeField.GetString() ?? "";
}

/// <summary>Sends every Twilio request to SendMock's provider port, keeping its path and query.</summary>
sealed class ProviderPortHandler(Uri providerUrl) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage twilioRequest,
        CancellationToken cancellationToken)
    {
        twilioRequest.RequestUri = new Uri(providerUrl, twilioRequest.RequestUri!.PathAndQuery);
        return base.SendAsync(twilioRequest, cancellationToken);
    }
}
