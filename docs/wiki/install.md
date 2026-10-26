---
title: Install
description: Binaries, Homebrew, Docker and building from source.
---

> **Coming with the first beta (Phase 1).** Docker `edge` images are published from `develop` from Phase 0. Stable channels arrive with 1.0 in Phase 5.

SendMock is one static binary with the web UI built in. Pick one way to install it below and follow its steps; all of them run the same thing.

Every way has a **stable** build (from `main`) and a **beta** build (from `develop`, with the newest features first). Use one or the other.

## Homebrew (macOS and Linux)

1. Install SendMock.

   Stable:

   ```bash
   brew install shibbirweb/tap/sendmock
   ```

   Beta:

   ```bash
   brew install shibbirweb/tap/sendmock-beta
   ```

2. Check that it is installed:

   ```bash
   sendmock --version
   ```

3. Go on to [Start SendMock](#start-sendmock).

## Install script (Linux and macOS)

The script downloads the right binary from the latest GitHub release, checks its checksum and puts `sendmock` on your `PATH`.

1. Run the install script.

   Stable:

   ```bash
   curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh
   ```

   Beta:

   ```bash
   curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --channel beta
   ```

2. Open a new terminal window, so it picks up the new `PATH`.

3. Check that it is installed:

   ```bash
   sendmock --version
   ```

4. Go on to [Start SendMock](#start-sendmock).

## Install script (Windows)

1. Open **PowerShell**.

2. Run the install script.

   Stable:

   ```powershell
   irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex
   ```

   Beta:

   ```powershell
   & ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1))) -Channel beta
   ```

3. Close PowerShell and open a new window, so it picks up the new `PATH`.

4. Check that it is installed:

   ```powershell
   sendmock --version
   ```

5. Go on to [Start SendMock](#start-sendmock).

## Docker

1. Start the container.

   Stable:

   ```bash
   docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock
   ```

   Beta:

   ```bash
   docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock:beta
   ```

2. Open the web UI at http://127.0.0.1:8025.

3. Point your app's SMTP settings at host `127.0.0.1`, port `1025`. [Connect your app](./connect/index.md) has the settings for each language.

Good to know:

- Inside Docker, SendMock listens on `0.0.0.0` so the published ports work. Outside Docker it listens on `127.0.0.1` only.
- Captured mail and SMS live in the container's `/data` folder. With `--rm` they are gone when the container stops; use Docker Compose below to keep them.

## Docker Compose

Use this to run SendMock next to your app, with captured mail and SMS kept across restarts.

1. In your project folder, create a file named `compose.yaml` (or add the `sendmock` service to the one you have):

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

   For the beta, change the `image` line to:

   ```yaml
   image: ghcr.io/shibbirweb/sendmock:beta
   ```

2. Start everything:

   ```bash
   docker compose up
   ```

3. Open the web UI at http://127.0.0.1:8025.

Good to know:

- Inside the Compose project, your app reaches SendMock by its service name: SMTP on `sendmock:1025` and the API on `http://sendmock:8025`.
- Your browser, on your own machine, still uses http://127.0.0.1:8025.
- [Connect your app](./connect/index.md) has the settings for each language.

## Binaries

1. Download the archive for your system. The links always point at the newest stable or beta build.

   | System | Archive | Stable | Beta |
   |--------|---------|--------|------|
   | macOS, Apple silicon | `sendmock-aarch64-apple-darwin.tar.gz` | [Download](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-aarch64-apple-darwin.tar.gz) | [Download](https://github.com/shibbirweb/sendmock/releases/download/beta/sendmock-aarch64-apple-darwin.tar.gz) |
   | macOS, Intel | `sendmock-x86_64-apple-darwin.tar.gz` | [Download](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-x86_64-apple-darwin.tar.gz) | [Download](https://github.com/shibbirweb/sendmock/releases/download/beta/sendmock-x86_64-apple-darwin.tar.gz) |
   | Windows, x64 | `sendmock-x86_64-pc-windows-msvc.zip` | [Download](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-x86_64-pc-windows-msvc.zip) | [Download](https://github.com/shibbirweb/sendmock/releases/download/beta/sendmock-x86_64-pc-windows-msvc.zip) |
   | Windows, Arm64 | `sendmock-aarch64-pc-windows-msvc.zip` | [Download](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-aarch64-pc-windows-msvc.zip) | [Download](https://github.com/shibbirweb/sendmock/releases/download/beta/sendmock-aarch64-pc-windows-msvc.zip) |
   | Linux, x64 (static) | `sendmock-x86_64-unknown-linux-musl.tar.gz` | [Download](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-x86_64-unknown-linux-musl.tar.gz) | [Download](https://github.com/shibbirweb/sendmock/releases/download/beta/sendmock-x86_64-unknown-linux-musl.tar.gz) |
   | Linux, Arm64 (static) | `sendmock-aarch64-unknown-linux-musl.tar.gz` | [Download](https://github.com/shibbirweb/sendmock/releases/latest/download/sendmock-aarch64-unknown-linux-musl.tar.gz) | [Download](https://github.com/shibbirweb/sendmock/releases/download/beta/sendmock-aarch64-unknown-linux-musl.tar.gz) |

2. Unpack it.

   macOS and Linux:

   ```bash
   tar -xzf sendmock-*.tar.gz
   ```

   Windows (PowerShell):

   ```powershell
   Expand-Archive -Path .\sendmock-*.zip -DestinationPath .\sendmock
   ```

3. Put `sendmock` on your `PATH`.

   macOS and Linux:

   ```bash
   sudo mv sendmock /usr/local/bin/
   ```

   Windows (PowerShell), then open a new window:

   ```powershell
   $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$userPath;$PWD\sendmock", "User")
   ```

4. Check that it is installed:

   ```bash
   sendmock --version
   ```

5. Go on to [Start SendMock](#start-sendmock).

Every release also has a `SHA256SUMS` file to check the download, and older versions are on the [releases page](https://github.com/shibbirweb/sendmock/releases).

## Start SendMock

After installing with Homebrew, an install script or a binary:

1. Start the server:

   ```bash
   sendmock
   ```

2. Open the web UI at http://127.0.0.1:8025.

3. Optional: in a second terminal, check that it is healthy:

   ```bash
   sendmock health
   ```

4. Point your app's SMTP settings at host `127.0.0.1`, port `1025`. [Connect your app](./connect/index.md) has the settings for each language.
