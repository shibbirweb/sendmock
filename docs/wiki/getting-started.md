---
title: Getting started
description: Install SendMock, explore it with samples, connect your app and get your first webhook, in about 10 minutes.
---

> **Coming with the first beta (Phase 1).** Installers and the server are not released yet. Until then, steps 2, 4 and 5 can be tried in the [live demo](/demo/).

This first run uses only what SendMock ships with. Nothing needs to be configured.

## 1. Install and run

1. Install SendMock. Pick your system:

   ```bash tab="macOS" tab-group="os"
   brew install shibbirweb/tap/sendmock
   ```

   ```bash tab="Linux"
   curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh
   ```

   ```powershell tab="Windows"
   irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex
   ```

   ```bash tab="Docker"
   docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock
   ```

   On Linux and Windows, open a new terminal window afterwards, so it picks up the new `PATH`.

2. Start SendMock:

   ```bash
   sendmock
   ```

   With Docker, the container from step 1 is already running, so skip this step.

Need a beta build, Docker Compose, Homebrew on Linux or a binary to download yourself? [Install](./install.md) has every way to install, step by step: [macOS](./install.md#homebrew-macos-and-linux), [Linux](./install.md#install-script-linux-and-macos), [Windows](./install.md#install-script-windows), [Docker](./install.md#docker) and [Binaries](./install.md#binaries).

### Install with AI

Rather let your AI coding agent do it? It checks your computer, asks whether you want Docker or the binary (and explains both in plain words), and shows every command before it runs it.

1. Open your AI agent (Claude Code, Codex, Cursor, Gemini CLI or another one that can run commands) in a terminal on this computer, and allow it to run commands.
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

3. Answer its questions and approve each command once you have read what it does.

More about it on [Install](./install.md#install-with-ai).

SendMock listens on `127.0.0.1` only:

| Port | What |
| --- | --- |
| `1025` | SMTP |
| `8025` | Web UI, REST API, WebSocket, native send APIs and `/catch/*` |
| `8026` | Provider emulation at the real provider paths (Twilio, SendGrid, ...) |

## 2. Look around with samples

Open `http://127.0.0.1:8025`. A fresh install is empty, and every empty screen offers a sample button:

1. In **Mail**, press **Send a sample email**. It arrives over SMTP, so it also shows in **Logs > SMTP**. Open it: the one-time code is pulled out with a copy button.
2. In **SMS**, press **Send a sample SMS** and open the conversation. The ticks move from sent to delivered.
3. In **SMS > Verify**, press **Start a sample verification**. The code shows with a live countdown.

Samples fire the same events as real traffic, so you can follow them through the whole app. The [Tour of the app](./tour.md) explains each menu.

## 3. Point your app at SendMock

Open **Settings > Connection**, pick your language and **Where does your app run?** (this machine, a container, or the same Docker Compose project), and copy the settings. Usually it is two values:

- the mail host: `127.0.0.1`, port `1025`, no username, password or TLS needed;
- the SMS or payment provider's base URL: `http://127.0.0.1:8026`.

Each language has a page in [Connect your app](./connect/index.md).

## 4. Send something real

Trigger a password reset or a sign-up in your app. The email appears in **Mail** within a second, with its HTML, headers, attachments and any one-time code or link already extracted. Click the link from SendMock to continue the flow in your app.

## 5. Get your first webhook

Webhooks are how SendMock talks back to your app. Try it without touching your app first:

1. Go to **Webhooks > Endpoints**. On a fresh install press **Add a catcher endpoint**; otherwise press **Add endpoint**, name it `Catcher` and set the URL to `http://127.0.0.1:8025/catch/webhooks`. Either way, deliveries land in SendMock's own HTTP Catcher.
2. Press **Send test** on the endpoint. The dialog shows the status code and the signed request.
3. Go to **Webhooks > Rules**, press **Add rule**, pick the endpoint and the `email.received` event, and save.
4. Send another sample email. A delivery appears in **Webhooks > Deliveries**, and the request itself in **HTTP Catcher** under the `webhooks` bin.

When you are ready, change the endpoint's URL to your app's handler and pick the template your app expects (for example Postmark inbound). See [Webhooks](./webhooks/index.md).

## Next steps

- [What can I test?](./use-cases.md): find the recipe for your problem.
- [How it all connects](./how-it-connects.md): the one idea behind every screen.
- [Recipes](./recipes/index.md): short tasks with the built-in features.
