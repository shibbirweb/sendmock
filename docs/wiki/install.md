---
title: Install
description: Binaries, Homebrew, Docker and building from source.
---

> **Coming with the first beta (Phase 1).** Docker `edge` images are published from `develop` from Phase 0. Stable channels arrive with 1.0 in Phase 5.

SendMock is one static binary with the web UI built in. Pick whichever channel suits you; all of them run the same thing.

## Homebrew (macOS and Linux)

```bash
brew install shibbirweb/tap/sendmock        # stable
brew install shibbirweb/tap/sendmock-beta   # beta from develop
```

## Install script (Linux, macOS and Windows)

Downloads the right binary from the latest GitHub release, checks its checksum and puts `sendmock` on your `PATH`.

```bash
curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh                      # Linux and macOS
curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --channel beta # beta from develop
```

```powershell
irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex   # Windows PowerShell
```

## Docker

```bash
docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock
```

In Docker, SendMock binds `0.0.0.0` so the published ports work; outside Docker it binds `127.0.0.1` only. Data lives in the `/data` volume.

### Docker Compose

To run SendMock next to your app, add it as a service in `compose.yaml` and start everything with `docker compose up`:

```yaml
services:
  sendmock:
    image: ghcr.io/shibbirweb/sendmock
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI, API and MCP
    volumes:
      - sendmock-data:/data # keeps captured mail and SMS across restarts

  app:
    build: .
    environment:
      MAIL_HOST: sendmock # the service name, not 127.0.0.1
      MAIL_PORT: 1025
    depends_on:
      sendmock:
        condition: service_healthy # waits for the image's built-in health check

volumes:
  sendmock-data:
```

Inside the Compose project your app reaches SendMock by its service name (`sendmock:1025`, `http://sendmock:8025`); your browser still opens the UI at http://127.0.0.1:8025. [Connect your app](./connect/index.md) has the settings for each language.

## Binaries

Download the archive for your system, unpack it and put `sendmock` (`sendmock.exe` on Windows) on your `PATH`. The links always point at the latest release:

| System | Archive |
|--------|---------|
| macOS, Apple silicon | [sendmock-aarch64-apple-darwin.tar.gz](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-aarch64-apple-darwin.tar.gz) |
| macOS, Intel | [sendmock-x86_64-apple-darwin.tar.gz](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-x86_64-apple-darwin.tar.gz) |
| Windows, x64 | [sendmock-x86_64-pc-windows-msvc.zip](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-x86_64-pc-windows-msvc.zip) |
| Windows, Arm64 | [sendmock-aarch64-pc-windows-msvc.zip](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-aarch64-pc-windows-msvc.zip) |
| Linux, x64 (static) | [sendmock-x86_64-unknown-linux-musl.tar.gz](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-x86_64-unknown-linux-musl.tar.gz) |
| Linux, Arm64 (static) | [sendmock-aarch64-unknown-linux-musl.tar.gz](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-aarch64-unknown-linux-musl.tar.gz) |

Every release also has a `SHA256SUMS` file to check the download, and older versions and beta builds are on the [releases page](https://github.com/shibbirweb/sendmock/releases).

## Check it runs

```bash
sendmock --version
sendmock health
```
