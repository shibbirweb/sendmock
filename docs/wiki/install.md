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

## Binaries

Download the archive for macOS, Linux or Windows from the GitHub releases page, unpack it and put `sendmock` on your `PATH`.

## Check it runs

```bash
sendmock --version
sendmock health
```
