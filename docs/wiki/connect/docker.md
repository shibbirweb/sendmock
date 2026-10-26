---
title: Docker
description: Connect your app to SendMock when either of them runs in Docker, with Compose, CI and webhook examples.
---

> **Applies from the first beta (Phase 1).** See [Install](../install.md) to start SendMock in Docker, and your language's page for the code side.

## Which address to use

Inside a container, `127.0.0.1` is the container itself. Pick the row that matches where each one runs:

| Your app runs | SendMock runs | SMTP | SendMock API |
| --- | --- | --- | --- |
| on your machine | in Docker (`docker run`) | `127.0.0.1:1025` | `http://127.0.0.1:8025` |
| in the same Compose project | in that Compose project | `sendmock:1025` | `http://sendmock:8025` |
| in a container | on your machine | `host.docker.internal:1025` | `http://host.docker.internal:8025` |
| in a CI job | as a CI service container | `127.0.0.1:1025` | `http://127.0.0.1:8025` |

The examples below use Laravel's `.env` names (`MAIL_HOST`, `MAIL_PORT`). For other languages, put the same host and port into the settings shown on your language's page: [PHP](./php.md), [Node.js](./node.md), [Python](./python.md), [Go](./go.md), [Java](./java.md), [Rust](./rust.md), [Ruby](./ruby.md), [.NET](./dotnet.md).

## SendMock in Docker, your app on your machine

1. Start SendMock:

   ```bash
   docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock
   ```

2. Point your app at the published port. Laravel `.env`:

   ```bash
   MAIL_MAILER=smtp
   MAIL_HOST=127.0.0.1
   MAIL_PORT=1025
   MAIL_ENCRYPTION=null
   ```

3. Send a message from your app and open http://127.0.0.1:8025 to see it.

## SendMock and your app in one Compose project

1. Add a `sendmock` service next to your app in `compose.yaml`, and point your app at it by the service name:

   ```yaml
   services:
     sendmock:
       image: ghcr.io/shibbirweb/sendmock
       ports:
         - "1025:1025"
         - "8025:8025"
       volumes:
         - sendmock-data:/data

     app:
       build: .
       environment:
         MAIL_MAILER: smtp
         MAIL_HOST: sendmock
         MAIL_PORT: 1025
         MAIL_ENCRYPTION: "null"
       depends_on:
         sendmock:
           condition: service_healthy

   volumes:
     sendmock-data:
   ```

2. Start everything:

   ```bash
   docker compose up
   ```

3. Open http://127.0.0.1:8025 in your browser to see what your app sent.

Good to know:

- `depends_on` with `service_healthy` makes your app wait until SendMock's built-in health check passes, so the first email is not lost at start-up.
- The `sendmock-data` volume keeps captured mail and SMS when the containers restart.
- Symfony apps use one setting instead: `MAILER_DSN: smtp://sendmock:1025`.

## Use provider SDKs from Compose (Twilio, SendGrid, ...)

SDKs that only let you change the host talk to SendMock's provider port, `8026`. It is off until you set its address.

1. Turn on the provider port in the `sendmock` service:

   ```yaml
   sendmock:
     image: ghcr.io/shibbirweb/sendmock
     ports:
       - "1025:1025"
       - "8025:8025"
       - "8026:8026"
     environment:
       SENDMOCK_PROVIDER_ADDR: 0.0.0.0:8026
   ```

2. Set your SDK's base URL to the service name and that port:

   ```text
   http://sendmock:8026
   ```

3. Send a message; it shows in **SMS** or **Mail** like any other. The [SMS](../sms/index.md) and [Mail](../mail/index.md) pages list the supported providers.

## Your app in a container, SendMock on your machine

### Docker Desktop (macOS and Windows)

1. Start SendMock on your machine:

   ```bash
   sendmock
   ```

2. Point the app in the container at `host.docker.internal`:

   ```bash
   MAIL_HOST=host.docker.internal
   MAIL_PORT=1025
   ```

### Linux

On Linux, `host.docker.internal` must be added to the container, and SendMock must listen on all interfaces, because the container cannot reach your machine's `127.0.0.1`.

1. Start SendMock listening on all interfaces:

   ```bash
   sendmock serve --smtp-addr 0.0.0.0:1025 --http-addr 0.0.0.0:8025
   ```

2. Add `host.docker.internal` to your app's service in `compose.yaml`:

   ```yaml
   app:
     extra_hosts:
       - "host.docker.internal:host-gateway"
     environment:
       MAIL_HOST: host.docker.internal
       MAIL_PORT: 1025
   ```

   Or, with `docker run`, add this flag:

   ```bash
   --add-host=host.docker.internal:host-gateway
   ```

Listening on all interfaces makes SendMock reachable from your network too; protect the UI as shown in [Protect the UI](#protect-the-ui-when-ports-are-published), or use a firewall.

## Send webhooks back to your app

When a rule fires, SendMock calls the endpoint URL you set in **Webhooks > Endpoints**. Use the address SendMock can reach from where it runs:

| SendMock runs | Your app runs | Endpoint URL example |
| --- | --- | --- |
| in Compose | in the same Compose project (service `app`, port 8000) | `http://app:8000/webhooks/sendmock` |
| in Docker | on your machine (port 8000) | `http://host.docker.internal:8000/webhooks/sendmock` |
| on your machine | on your machine | `http://127.0.0.1:8000/webhooks/sendmock` |

On Linux, start the SendMock container with `--add-host=host.docker.internal:host-gateway` (or `extra_hosts` in Compose) for the second row. The endpoint editor warns when a URL uses `localhost` from inside a container.

## Load a seed file

Endpoints, rules, numbers and templates can come from a [seed file](../advanced/seed-file.md), so every teammate starts with the same setup.

1. Put `sendmock.seed.toml` in your project folder.

2. Mount it into the `sendmock` service:

   ```yaml
   sendmock:
     image: ghcr.io/shibbirweb/sendmock
     volumes:
       - sendmock-data:/data
       - ./sendmock.seed.toml:/config/sendmock.seed.toml:ro
   ```

3. Restart the service; SendMock loads the file on start:

   ```bash
   docker compose up -d sendmock
   ```

## Protect the UI when ports are published

Published ports can be reached from other machines on your network. Set a username and password for the web UI and API:

```yaml
sendmock:
  image: ghcr.io/shibbirweb/sendmock
  environment:
    SENDMOCK_UI_AUTH: admin:change-me
```

Use your own password instead of `change-me`.

## Run SendMock in CI (GitHub Actions)

1. Add SendMock as a service container in your workflow. The runner waits for the image's health check before your steps start:

   ```yaml
   jobs:
     test:
       runs-on: ubuntu-latest
       services:
         sendmock:
           image: ghcr.io/shibbirweb/sendmock
           ports:
             - 1025:1025
             - 8025:8025
       steps:
         - uses: actions/checkout@v5
         - name: Run the tests
           run: ./vendor/bin/phpunit
           env:
             MAIL_HOST: 127.0.0.1
             MAIL_PORT: 1025
   ```

2. In your tests, read what the app sent through the API, for example wait up to 10 seconds for an email to an address:

   ```bash
   curl "http://127.0.0.1:8025/api/v1/wait/email?to=user@example.com&timeout=10s"
   ```

The [API reference](/api/) lists every endpoint your tests can use.
