---
title: Install
description: Binaries, Homebrew, Docker and building from source.
---

> **Coming with the first beta (Phase 1).** Docker `edge` images are published from `develop` from Phase 0. Stable channels arrive with 1.0 in Phase 5.

SendMock is one static binary with the web UI built in. Pick one way to install it below and follow its steps; all of them run the same thing.

Every way has a **stable** build (from `main`) and a **beta** build (from `develop`, with the newest features first). Use one or the other. The beta has its own docs; see [Docs versions](./versions.md).

## Install with AI

Let your AI coding agent (Claude Code, Codex, Cursor, Gemini CLI or another one that can run commands) install SendMock for you. It checks your computer first, asks you a few simple questions and shows every command before it runs it.

1. Open your AI agent in a terminal on the computer where SendMock should run, and allow it to run commands.
2. Copy this prompt and paste it into the agent:

   ```text
   Install SendMock on this computer for me. SendMock is a local sandbox that catches the emails, SMS and webhooks my apps send: https://shibbirweb.github.io/sendmock/

   Follow these steps and talk to me in plain, simple words:

   1. Before you install anything, check this computer and tell me what you found: the operating system and CPU (for example macOS on Apple silicon, Windows on x64, Linux on ARM), whether Docker is installed and running, whether Homebrew is installed, and whether SendMock is already installed (`sendmock --version`).

   2. Ask me how I want to run SendMock, and recommend one based on what you found:
      - Docker: SendMock runs in a container, nothing is installed on my computer, and it is easy to remove. Good if I already use Docker or Docker Compose. Docker must be running.
      - The binary: one small program installed on my computer. It starts instantly and does not need Docker.

   3. Ask me whether I want the stable version (recommended) or the beta (newest features first).

   4. Use only these official commands, for my choice and my system:
      - macOS or Linux with Homebrew, stable: `brew install shibbirweb/tap/sendmock`
      - macOS or Linux with Homebrew, beta: `brew install shibbirweb/tap/sendmock-beta`
      - Linux or macOS without Homebrew, stable: `curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh`
      - Linux or macOS without Homebrew, beta: `curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --channel beta`
      - Windows (PowerShell), stable: `irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex`
      - Windows (PowerShell), beta: `& ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1))) -Channel beta`
      - Docker, stable: `docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock`
      - Docker, beta: `docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock:beta`
      The full steps are on https://shibbirweb.github.io/sendmock/docs/install/. Before you run each command, show it to me, say in one sentence what it does, and wait for my OK.

   5. If a download fails because SendMock has no release yet, stop and tell me so. I can try the live demo instead: https://shibbirweb.github.io/sendmock/demo/

   6. When it is installed, start SendMock so it keeps running after you finish (in the background, or give me the command to run in a new terminal), and check that it works: open http://127.0.0.1:8025. Then tell me the web UI address, the SMTP settings for my app (host 127.0.0.1, port 1025, no username, password or TLS) and how to stop SendMock.

   Do not change any other settings on this computer, and ask me before you install anything else.
   ```

3. Answer its questions: Docker or the binary, and stable or beta. Approve each command once you have read what it does.

Prefer to do it yourself? Pick a way to install below.

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

Prefer to download the binary yourself? Go to [Binaries](#binaries).

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

Prefer to download the binary yourself? Go to [Binaries](#binaries).

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

Prefer to download the binary yourself? Go to [Binaries](#binaries).

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

The same image is also on Docker Hub: [shibbirweb/sendmock](https://hub.docker.com/r/shibbirweb/sendmock).

Good to know:

- Inside Docker, SendMock listens on `0.0.0.0` so the published ports work. Outside Docker it listens on `127.0.0.1` only.
- Captured mail and SMS live in the container's `/data` folder. With `--rm` they are gone when the container stops; use Docker Compose below to keep them.
- To connect an app that also runs in Docker, see [Connect your app: Docker](./connect/docker.md).

## Docker Compose

Use this to keep SendMock running with captured mail and SMS kept across restarts.

1. In your project folder, create a file named `compose.yaml`:

   ```yaml
   services:
     sendmock:
       image: ghcr.io/shibbirweb/sendmock
       ports:
         - "1025:1025"
         - "8025:8025"
       volumes:
         - sendmock-data:/data

   volumes:
     sendmock-data:
   ```

   For the beta, change the `image` line to:

   ```yaml
   image: ghcr.io/shibbirweb/sendmock:beta
   ```

2. Start it:

   ```bash
   docker compose up
   ```

3. Open the web UI at http://127.0.0.1:8025.

To run SendMock next to your app in the same Compose project, or for CI, webhooks and seed files, see [Connect your app: Docker](./connect/docker.md).

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
