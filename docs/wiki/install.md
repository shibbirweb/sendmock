---
title: Install
description: Every way to install SendMock, from install scripts and package managers to Docker and binaries.
---

> **Downloads start with the first beta.** Until it is published, build SendMock from source ([Run it from source](https://github.com/shibbirweb/sendmock#run-it-from-source)) or try the [live demo](/demo/).

SendMock is one static binary with the web UI built in. Pick one way to install it below and follow its steps; all of them run the same thing.

Every way has a **stable** build (from `main`) and a **beta** build (from `develop`, with the newest features first). Use one or the other. The beta has its own docs; see [Docs versions](./versions.md).

## Which way to choose

Every way below installs the same `sendmock`. The table says which systems each one serves and whether it has the stable, the beta or both.

| Way to install | Systems | Stable | Beta |
|---|---|---|---|
| [npx](#npx-no-install) | macOS, Linux, Windows | Yes | Yes |
| [bunx](#bunx-no-install) | macOS, Linux, Windows | Yes | Yes |
| [Homebrew](#homebrew-macos-and-linux) | macOS, Linux | Yes | Yes |
| [Install script (Linux and macOS)](#install-script-linux-and-macos) | macOS, Linux | Yes | Yes |
| [Install script (Windows)](#install-script-windows) | Windows | Yes | Yes |
| [apt](#apt-debian-and-ubuntu) | Linux | Yes | Yes |
| [dnf](#dnf-fedora-rhel-and-similar) | Linux | Yes | Yes |
| [Nix](#nix) | Linux, macOS | Yes | No |
| [Scoop](#scoop-windows) | Windows | Yes | Yes |
| [WinGet](#winget-windows) | Windows | Yes | No |
| [Chocolatey](#chocolatey-windows) | Windows | Yes | No |
| [npm](#npm-projects-with-nodejs) | macOS, Linux, Windows | Yes | Yes |
| [Cargo](#cargo-rust-developers) | macOS, Linux, Windows | Yes | No |
| [Docker](#docker) | macOS, Linux, Windows | Yes | Yes |
| [Binaries](#binaries) | macOS, Linux, Windows | Yes | Yes |

## npx (no install)

Run SendMock straight from npm without installing anything first. You need Node.js 18 or newer (or Bun, pnpm or Yarn). The first run downloads the binary for your computer (under 20 MB) into the package manager's cache; later runs start at once.

1. Start the stable:

   ```bash
   npx sendmock
   ```

   Or the beta:

   ```bash
   npx sendmock@beta
   ```

2. Any command works the same way, for example the MCP server for an AI agent:

   ```bash
   npx sendmock mcp
   ```

3. With another package manager, use its runner instead of `npx`:

   ```bash
   bunx sendmock
   ```

   ```bash
   pnpm dlx sendmock
   ```

   ```bash
   yarn dlx sendmock
   ```

Then go on to [Start SendMock](#start-sendmock).

## bunx (no install)

Run SendMock straight from npm with Bun, without installing anything first. You need [Bun](https://bun.sh). The first run downloads the binary for your computer (under 20 MB) into Bun's cache; later runs start at once.

1. Start the stable:

   ```bash
   bunx sendmock
   ```

   Or the beta:

   ```bash
   bunx sendmock@beta
   ```

2. Any command works the same way, for example the MCP server for an AI agent:

   ```bash
   bunx sendmock mcp
   ```

Then go on to [Start SendMock](#start-sendmock).

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
   curl -fsSL https://github.com/shibbirweb/sendmock/releases/download/beta/install.sh | sh -s -- --channel beta
   ```

   It puts `sendmock` in `~/.local/bin` and adds that folder to your shell's profile. Add `--install-dir <folder>` to choose another folder, or `--no-modify-path` to leave your profile as it is.

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
   & ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/download/beta/install.ps1))) -Channel beta
   ```

   It puts `sendmock.exe` in `%LOCALAPPDATA%\Programs\sendmock` and adds that folder to your user `Path`. To choose another folder, run it as a script block with `-InstallDir <folder>`; add `-NoModifyPath` to leave your `Path` as it is.

3. Close PowerShell and open a new window, so it picks up the new `PATH`.

4. Check that it is installed:

   ```powershell
   sendmock --version
   ```

5. Go on to [Start SendMock](#start-sendmock).

Prefer to download the binary yourself? Go to [Binaries](#binaries).

## apt (Debian and Ubuntu)

Our signed repository keeps SendMock up to date with the rest of your system.

1. Add the repository's signing key:

   ```bash
   sudo install -d -m 0755 /etc/apt/keyrings
   ```

   ```bash
   curl -fsSL https://shibbirweb.github.io/sendmock/packages/sendmock.gpg | sudo tee /etc/apt/keyrings/sendmock.gpg > /dev/null
   ```

2. Add the repository.

   Stable:

   ```bash
   echo "deb [signed-by=/etc/apt/keyrings/sendmock.gpg] https://shibbirweb.github.io/sendmock/packages/apt stable main" | sudo tee /etc/apt/sources.list.d/sendmock.list
   ```

   Beta:

   ```bash
   echo "deb [signed-by=/etc/apt/keyrings/sendmock.gpg] https://shibbirweb.github.io/sendmock/packages/apt beta main" | sudo tee /etc/apt/sources.list.d/sendmock.list
   ```

3. Install SendMock:

   ```bash
   sudo apt update
   ```

   ```bash
   sudo apt install sendmock
   ```

4. Check that it is installed, then go on to [Start SendMock](#start-sendmock):

   ```bash
   sendmock --version
   ```

`sudo apt upgrade` installs new releases. Each release also attaches the `.deb` file, for `sudo apt install ./sendmock_<version>_amd64.deb` without the repository.

## dnf (Fedora, RHEL and similar)

1. Add the repository.

   Stable:

   ```bash
   sudo curl -fsSL -o /etc/yum.repos.d/sendmock.repo https://shibbirweb.github.io/sendmock/packages/sendmock-stable.repo
   ```

   Beta:

   ```bash
   sudo curl -fsSL -o /etc/yum.repos.d/sendmock.repo https://shibbirweb.github.io/sendmock/packages/sendmock-beta.repo
   ```

2. Install SendMock. The first time, dnf asks you to accept the repository's signing key:

   ```bash
   sudo dnf install sendmock
   ```

3. Check that it is installed, then go on to [Start SendMock](#start-sendmock):

   ```bash
   sendmock --version
   ```

`sudo dnf upgrade` installs new releases. Each release also attaches the `.rpm` file, for `sudo dnf install ./sendmock-<version>.x86_64.rpm` without the repository.

## Nix

Nixpkgs has the stable once its maintainers have merged it.

1. Run SendMock without installing it:

   ```bash
   nix run nixpkgs#sendmock
   ```

2. Or install it into your profile:

   ```bash
   nix profile install nixpkgs#sendmock
   ```

3. Go on to [Start SendMock](#start-sendmock).

## Scoop (Windows)

1. Add the SendMock bucket:

   ```powershell
   scoop bucket add shibbirweb https://github.com/shibbirweb/scoop-bucket
   ```

2. Install SendMock.

   Stable:

   ```powershell
   scoop install shibbirweb/sendmock
   ```

   Beta:

   ```powershell
   scoop install shibbirweb/sendmock-beta
   ```

3. Check that it is installed:

   ```powershell
   sendmock --version
   ```

4. Go on to [Start SendMock](#start-sendmock).

## WinGet (Windows)

WinGet is built into Windows 10 and 11. It has the stable only.

1. Install SendMock:

   ```powershell
   winget install shibbirweb.sendmock
   ```

2. Open a new PowerShell window and check that it is installed:

   ```powershell
   sendmock --version
   ```

3. Go on to [Start SendMock](#start-sendmock). `winget upgrade shibbirweb.sendmock` installs new releases.

## Chocolatey (Windows)

Chocolatey has the stable only. A new version appears there once Chocolatey's moderators approve it, which can take a few days.

1. Install SendMock from an administrator PowerShell:

   ```powershell
   choco install sendmock
   ```

2. Check that it is installed:

   ```powershell
   sendmock --version
   ```

3. Go on to [Start SendMock](#start-sendmock). `choco upgrade sendmock` installs new releases.

## npm (projects with Node.js)

The `sendmock` package runs the right binary for your computer, so a JavaScript project can keep SendMock in its dev dependencies and start it in CI.

1. Add it to your project.

   Stable:

   ```bash
   npm install --save-dev sendmock
   ```

   Beta:

   ```bash
   npm install --save-dev sendmock@beta
   ```

2. Check that it runs:

   ```bash
   npx sendmock --version
   ```

3. Start it with `npx sendmock`, or add `"sendmock": "sendmock"` to your `scripts`. Then go on to [Start SendMock](#start-sendmock).

## Cargo (Rust developers)

The stable comes from crates.io and builds from source, with the web UI already inside. There is no beta here; use another way for the beta.

1. Install SendMock:

   ```bash
   cargo install sendmock --locked
   ```

2. Check that it is installed:

   ```bash
   sendmock --version
   ```

3. Go on to [Start SendMock](#start-sendmock).

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

## Docker Desktop extension

The extension runs SendMock inside Docker Desktop and adds a **SendMock** tab that shows whether it is running and opens the web UI. SMTP is on `localhost:1025` and the web UI on `http://localhost:8025`, as with `docker run`. Each release publishes it on GitHub's container registry, and each version runs the SendMock of the same version.

1. Install it into Docker Desktop (answer `y` when Docker asks to confirm an extension that is not from its Marketplace):

   ```bash
   docker extension install ghcr.io/shibbirweb/sendmock-docker-extension:latest
   ```

2. Open **SendMock** in Docker Desktop's sidebar, then **Open SendMock**.

For a beta, use its version as the tag instead of `latest`, for example `ghcr.io/shibbirweb/sendmock-docker-extension:0.1.0-beta.1`.

To try changes that are not released yet, build it from a clone of the repository:

1. Get the repository:

   ```bash
   git clone https://github.com/shibbirweb/sendmock.git
   ```

2. Go into it:

   ```bash
   cd sendmock
   ```

3. Build the extension image:

   ```bash
   docker build -t sendmock-docker-extension:0.0.1 packaging/docker-desktop
   ```

4. Install it into Docker Desktop:

   ```bash
   docker extension install sendmock-docker-extension:0.0.1
   ```

5. Open **SendMock** in Docker Desktop's sidebar, then **Open SendMock**.

To remove it, run `docker extension rm sendmock-docker-extension`; its data volume stays until you delete it.

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
      - Linux or macOS without Homebrew, beta: `curl -fsSL https://github.com/shibbirweb/sendmock/releases/download/beta/install.sh | sh -s -- --channel beta`
      - Windows (PowerShell), stable: `irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex`
      - Windows (PowerShell), beta: `& ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/download/beta/install.ps1))) -Channel beta`
      - Docker, stable: `docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock`
      - Docker, beta: `docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock:beta`
      The full steps are on https://shibbirweb.github.io/sendmock/docs/install/. Before you run each command, show it to me, say in one sentence what it does, and wait for my OK.

   5. If a download fails because SendMock has no release yet, stop and tell me so. I can try the live demo instead: https://shibbirweb.github.io/sendmock/demo/

   6. When it is installed, start SendMock so it keeps running after you finish (in the background, or give me the command to run in a new terminal), and check that it works: open http://127.0.0.1:8025. Then tell me the web UI address, the SMTP settings for my app (host 127.0.0.1, port 1025, no username, password or TLS) and how to stop SendMock.

   Do not change any other settings on this computer, and ask me before you install anything else.
   ```

3. Answer its questions: Docker or the binary, and stable or beta. Approve each command once you have read what it does.

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

## Menu bar and tray app

`sendmock-tray` puts SendMock in the macOS menu bar or the Windows and Linux system tray. It uses the SendMock already running at `http://127.0.0.1:8025`, or starts `sendmock serve` itself, and its menu shows the status and the unread email and SMS counts, opens the web UI, starts and stops the server it started, and quits (stopping only a server it started). It needs SendMock installed (any way above) and Rust to build.

1. On Linux only, install the libraries the tray uses (Debian and Ubuntu shown):

   ```bash
   sudo apt-get install -y libgtk-3-dev libxdo-dev libayatana-appindicator3-dev
   ```

2. Install the tray app:

   ```bash
   cargo install sendmock-tray --features gui --locked
   ```

3. Start it:

   ```bash
   sendmock-tray
   ```

4. Click the envelope in the menu bar or tray. On macOS the unread total shows next to it.

To watch another address, start it with `sendmock-tray --url http://127.0.0.1:9000`; to start a particular binary, add `--sendmock /path/to/sendmock`. A server the tray starts keeps its data where `sendmock` always does.

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

To look around before your app sends anything, start it with sample data instead: `sendmock --demo` fills an empty instance with the emails, SMS, webhooks, catcher bins and payments the [live demo](/demo/) shows. An instance that already holds data is left as it is.
