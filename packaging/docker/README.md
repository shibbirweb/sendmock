# SendMock

Catch the email, SMS, push notifications, payments and webhooks your app sends, and see them in a web UI. SendMock runs a local SMTP server and the provider APIs your app already talks to (Twilio, SendGrid, Stripe, FCM and more), so nothing reaches a real inbox, phone or card while you develop and test.

- **Docs:** https://shibbirweb.github.io/sendmock/docs/
- **Source and issues:** https://github.com/shibbirweb/sendmock
- **Also on GitHub's registry:** `ghcr.io/shibbirweb/sendmock` (the same image)

## Quick start

1. Start SendMock:

   ```bash
   docker run --rm -p 1025:1025 -p 8025:8025 shibbirweb/sendmock
   ```

2. Point your app's SMTP settings at `127.0.0.1`, port `1025`, with no encryption.

3. Send a message from your app and open http://127.0.0.1:8025 to see it.

## Docker Compose

Keeps captured mail and SMS across restarts:

```yaml
services:
  sendmock:
    image: shibbirweb/sendmock
    ports:
      - "1025:1025"
      - "8025:8025"
    volumes:
      - sendmock-data:/data

volumes:
  sendmock-data:
```

Apps in the same Compose project reach it at `sendmock:1025` (SMTP) and `http://sendmock:8025` (web UI and API).

## Ports

| Port | What | On by default |
| --- | --- | --- |
| `1025` | SMTP: point your app's mail settings here | yes |
| `8025` | Web UI and REST API | yes |
| `8026` | Provider APIs for SDKs that only let you change the host (Twilio, SendGrid, ...) | no: set `SENDMOCK_PROVIDER_ADDR=0.0.0.0:8026` and publish the port |

## Tags

| Tag | What it is |
| --- | --- |
| `latest`, `1`, `1.0`, `1.0.0` | the stable release and its major, minor and exact versions |
| `beta`, `0.1.0-beta.1` | the newest beta, and each beta version |
| `edge` | every merge to the `develop` branch |
| `<any tag>-debug` | the same SendMock on a base with a shell (`/busybox/sh`), for looking inside a running container |

Every image is built for `linux/amd64` and `linux/arm64`, signed with cosign (keyless, from this repository's release workflow), and published with an SBOM and build provenance.

## Settings

Any setting can be passed as an environment variable. The ones people use most in Docker:

| Variable | What it does |
| --- | --- |
| `SENDMOCK_UI_AUTH` | `user:password` for the web UI and API; set it when the ports can be reached from other machines |
| `SENDMOCK_PROVIDER_ADDR` | turns on the provider port, for example `0.0.0.0:8026` |

The full list is in the configuration guide: https://shibbirweb.github.io/sendmock/docs/configuration/

## Files the image reads

| Path | What to mount there |
| --- | --- |
| `/data` | a volume, to keep captured traffic across restarts (the SQLite database) |
| `/config/sendmock.seed.toml` | a seed file with endpoints, rules, numbers and templates, so every teammate starts the same |
| `/config/sendmock.toml` | a configuration file |
| `/templates` | webhook template files, read again when they change |

## Run it in CI (GitHub Actions)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      sendmock:
        image: shibbirweb/sendmock
        ports:
          - 1025:1025
          - 8025:8025
```

The runner waits for the image's health check before your steps start. In your tests, read what the app sent through the API, for example wait up to 10 seconds for an email:

```bash
curl "http://127.0.0.1:8025/api/v1/wait/email?to=user@example.com&timeout=10s"
```

## About the image

- Built `FROM scratch`: just the `sendmock` binary, CA certificates and empty `/data`, `/config`, `/templates` and `/tmp` folders.
- Runs as the non-root user `10001`.
- Has a health check (`sendmock health`), so Compose and CI wait until it is ready.

More: the Docker guide covers your app in a container, webhooks back to your app, and Linux host networking: https://shibbirweb.github.io/sendmock/docs/connect/docker/

## License

MIT or Apache-2.0, at your choice.
