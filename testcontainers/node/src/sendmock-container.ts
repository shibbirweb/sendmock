import {
  AbstractStartedContainer,
  GenericContainer,
  Wait,
} from "testcontainers";

export const defaultSendMockImage = "ghcr.io/shibbirweb/sendmock:beta";
const smtpPort = 1025;
const httpPort = 8025;
const providerPort = 8026;

/**
 * SendMock in Docker for a test: SMTP, the HTTP API and UI, and the provider port that
 * answers provider SDKs at their real paths.
 */
export class SendMockContainer extends GenericContainer {
  constructor(imageName: string = defaultSendMockImage) {
    super(imageName);
    this.withExposedPorts(smtpPort, httpPort, providerPort)
      .withEnvironment({
        SENDMOCK_PROVIDER_ADDR: `0.0.0.0:${providerPort}`,
      })
      .withWaitStrategy(Wait.forHttp("/api/v1/health", httpPort));
  }

  override async start(): Promise<StartedSendMockContainer> {
    return new StartedSendMockContainer(await super.start());
  }
}

export class StartedSendMockContainer extends AbstractStartedContainer {
  /** The host the SMTP port is reached on. */
  getSmtpHost(): string {
    return this.getHost();
  }

  /** The SMTP port on the host, for the app's mail settings. */
  getSmtpPort(): number {
    return this.getMappedPort(smtpPort);
  }

  /** The HTTP API and UI, e.g. `http://localhost:32768`. */
  getHttpUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(httpPort)}`;
  }

  /** The provider port, the base URL to give a provider SDK instead of the provider's own. */
  getProviderUrl(): string {
    return `http://${this.getHost()}:${this.getMappedPort(providerPort)}`;
  }
}
