"""SendMock in Docker for a test: SMTP, the HTTP API and UI, and the provider port that
answers provider SDKs at their real paths."""

from testcontainers.core.container import DockerContainer
from testcontainers.core.wait_strategies import HttpWaitStrategy

DEFAULT_IMAGE = "ghcr.io/shibbirweb/sendmock:beta"
SMTP_PORT = 1025
HTTP_PORT = 8025
PROVIDER_PORT = 8026


class SendMockContainer(DockerContainer):
    def __init__(self, image: str = DEFAULT_IMAGE, **container_options) -> None:
        super().__init__(image, **container_options)
        self.with_exposed_ports(SMTP_PORT, HTTP_PORT, PROVIDER_PORT)
        self.with_env("SENDMOCK_PROVIDER_ADDR", f"0.0.0.0:{PROVIDER_PORT}")
        self.waiting_for(HttpWaitStrategy(HTTP_PORT, "/api/v1/health"))

    def get_smtp_host(self) -> str:
        """The host the SMTP port is reached on."""
        return self.get_container_host_ip()

    def get_smtp_port(self) -> int:
        """The SMTP port on the host, for the app's mail settings."""
        return int(self.get_exposed_port(SMTP_PORT))

    def get_http_url(self) -> str:
        """The HTTP API and UI, e.g. `http://localhost:32768`."""
        return f"http://{self.get_container_host_ip()}:{self.get_exposed_port(HTTP_PORT)}"

    def get_provider_url(self) -> str:
        """The provider port, the base URL to give a provider SDK instead of the provider's own."""
        return f"http://{self.get_container_host_ip()}:{self.get_exposed_port(PROVIDER_PORT)}"


__all__ = ["DEFAULT_IMAGE", "SendMockContainer"]
