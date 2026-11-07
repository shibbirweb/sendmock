using System.Net;
using System.Net.Sockets;
using System.Text;
using Xunit;

namespace SendMock.Testcontainers.Tests;

public class SendMockContainerTest
{
    private static readonly string ImageUnderTest =
        Environment.GetEnvironmentVariable("SENDMOCK_IMAGE") ?? SendMockContainer.DefaultImage;

    private static async Task<string> ReadSmtpGreetingAsync(string smtpHost, int smtpPort)
    {
        using var smtpClient = new TcpClient();
        await smtpClient.ConnectAsync(smtpHost, smtpPort);
        using var smtpReader = new StreamReader(smtpClient.GetStream(), Encoding.ASCII);
        return await smtpReader.ReadLineAsync() ?? "";
    }

    // DS-06.1
    [Fact]
    public async Task StartsTheImageAndGivesTheSmtpHttpAndProviderAddresses()
    {
        await using var sendmock = new SendMockContainer(ImageUnderTest);
        await sendmock.StartAsync();
        using var httpClient = new HttpClient();

        var healthResponse = await httpClient.GetAsync($"{sendmock.HttpUrl}/api/v1/health");
        var twilioResponse = await httpClient.PostAsync(
            $"{sendmock.ProviderUrl}/2010-04-01/Accounts/AC00000000000000000000000000000007/Messages.json",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["From"] = "+15005550006",
                ["To"] = "+14155550106",
                ["Body"] = "From .NET",
            }));
        var smtpGreeting = await ReadSmtpGreetingAsync(sendmock.SmtpHost, sendmock.SmtpPortOnHost);

        Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, twilioResponse.StatusCode);
        Assert.StartsWith("220 ", smtpGreeting);
    }
}
