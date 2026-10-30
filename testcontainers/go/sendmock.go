// Package sendmock starts SendMock in Docker for a test: SMTP, the HTTP API and UI, and the
// provider port that answers provider SDKs at their real paths.
package sendmock

import (
	"context"
	"fmt"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

// DefaultImage is the image used when Run is given none.
const DefaultImage = "ghcr.io/shibbirweb/sendmock:beta"

const (
	smtpPort     = "1025/tcp"
	httpPort     = "8025/tcp"
	providerPort = "8026/tcp"
)

// Container is a running SendMock.
type Container struct {
	testcontainers.Container
}

// Run starts SendMock from the image and waits until its API answers.
func Run(ctx context.Context, image string, options ...testcontainers.ContainerCustomizer) (*Container, error) {
	moduleOptions := []testcontainers.ContainerCustomizer{
		testcontainers.WithExposedPorts(smtpPort, httpPort, providerPort),
		testcontainers.WithEnv(map[string]string{
			"SENDMOCK_PROVIDER_ADDR": "0.0.0.0:8026",
		}),
		testcontainers.WithWaitStrategy(wait.ForHTTP("/api/v1/health").WithPort(httpPort)),
	}
	startedContainer, err := testcontainers.Run(ctx, image, append(moduleOptions, options...)...)
	var sendmockContainer *Container
	if startedContainer != nil {
		sendmockContainer = &Container{Container: startedContainer}
	}
	if err != nil {
		return sendmockContainer, fmt.Errorf("start SendMock: %w", err)
	}

	return sendmockContainer, nil
}

// SMTPAddress is the host and port the app's mail settings point at, e.g. localhost:32768.
func (sendmockContainer *Container) SMTPAddress(ctx context.Context) (string, error) {
	return sendmockContainer.PortEndpoint(ctx, smtpPort, "")
}

// HTTPURL is the HTTP API and UI, e.g. http://localhost:32769.
func (sendmockContainer *Container) HTTPURL(ctx context.Context) (string, error) {
	return sendmockContainer.PortEndpoint(ctx, httpPort, "http")
}

// ProviderURL is the base URL to give a provider SDK instead of the provider's own.
func (sendmockContainer *Container) ProviderURL(ctx context.Context) (string, error) {
	return sendmockContainer.PortEndpoint(ctx, providerPort, "http")
}
