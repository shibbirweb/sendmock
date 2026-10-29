using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace SendMock.Testcontainers;

/// <summary>
/// SendMock in Docker for a test: SMTP, the HTTP API and UI, and the provider port that
/// answers provider SDKs at their real paths.
/// </summary>
public sealed class SendMockContainer : IAsyncDisposable
{
    public const string DefaultImage = "ghcr.io/shibbirweb/sendmock:beta";
    private const ushort SmtpPort = 1025;
    private const ushort HttpPort = 8025;
    private const ushort ProviderPort = 8026;

    private readonly IContainer _container;

    public SendMockContainer(string imageName = DefaultImage)
    {
        _container = new ContainerBuilder(imageName)
            .WithPortBinding(SmtpPort, true)
            .WithPortBinding(HttpPort, true)
            .WithPortBinding(ProviderPort, true)
            .WithEnvironment("SENDMOCK_PROVIDER_ADDR", $"0.0.0.0:{ProviderPort}")
            .WithWaitStrategy(Wait.ForUnixContainer()
                .UntilHttpRequestIsSucceeded(request => request.ForPort(HttpPort).ForPath("/api/v1/health")))
            .Build();
    }

    /// <summary>The host the SMTP port is reached on.</summary>
    public string SmtpHost => _container.Hostname;

    /// <summary>The SMTP port on the host, for the app's mail settings.</summary>
    public int SmtpPortOnHost => _container.GetMappedPublicPort(SmtpPort);

    /// <summary>The HTTP API and UI, e.g. <c>http://localhost:32768</c>.</summary>
    public string HttpUrl => $"http://{_container.Hostname}:{_container.GetMappedPublicPort(HttpPort)}";

    /// <summary>The provider port, the base URL to give a provider SDK instead of the provider's own.</summary>
    public string ProviderUrl => $"http://{_container.Hostname}:{_container.GetMappedPublicPort(ProviderPort)}";

    public Task StartAsync(CancellationToken cancellationToken = default) =>
        _container.StartAsync(cancellationToken);

    public ValueTask DisposeAsync() => _container.DisposeAsync();
}
