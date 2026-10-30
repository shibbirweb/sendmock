package io.github.shibbirweb.sendmock;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * SendMock in Docker for a test: SMTP, the HTTP API and UI, and the provider port that answers
 * provider SDKs at their real paths.
 */
public class SendMockContainer extends GenericContainer<SendMockContainer> {
    public static final String DEFAULT_IMAGE = "ghcr.io/shibbirweb/sendmock:beta";
    public static final int SMTP_PORT = 1025;
    public static final int HTTP_PORT = 8025;
    public static final int PROVIDER_PORT = 8026;

    public SendMockContainer() {
        this(DEFAULT_IMAGE);
    }

    public SendMockContainer(String imageName) {
        super(DockerImageName.parse(imageName));
        withExposedPorts(SMTP_PORT, HTTP_PORT, PROVIDER_PORT);
        withEnv("SENDMOCK_PROVIDER_ADDR", "0.0.0.0:" + PROVIDER_PORT);
        waitingFor(Wait.forHttp("/api/v1/health").forPort(HTTP_PORT));
    }

    /** The host the SMTP port is reached on. */
    public String getSmtpHost() {
        return getHost();
    }

    /** The SMTP port on the host, for the app's mail settings. */
    public int getSmtpPort() {
        return getMappedPort(SMTP_PORT);
    }

    /** The HTTP API and UI, e.g. {@code http://localhost:32768}. */
    public String getHttpUrl() {
        return "http://" + getHost() + ":" + getMappedPort(HTTP_PORT);
    }

    /** The provider port, the base URL to give a provider SDK instead of the provider's own. */
    public String getProviderUrl() {
        return "http://" + getHost() + ":" + getMappedPort(PROVIDER_PORT);
    }
}
