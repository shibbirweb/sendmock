---
title: Getting started
description: Install SendMock, point your app at it and see the first message.
---

> **Coming with the first beta (Phase 1).** Installers and the server are not released yet. Until then, every screen can be tried in the [live demo](/demo/).

## 1. Install and run

```bash
brew install shibbirweb/tap/sendmock
sendmock
```

SendMock listens on `127.0.0.1` only:

| Port | What |
| --- | --- |
| `1025` | SMTP |
| `8025` | Web UI, REST API, WebSocket, native send APIs and `/catch/*` |
| `8026` | Provider emulation at the real provider paths (Twilio, SendGrid, ...) |

Other ways to install are on [Install](./install.md).

## 2. Point your app at it

Change the mail host to `127.0.0.1:1025` and the SMS or payment provider's base URL to SendMock. The settings for each language are in [Connect your app](./connect/index.md).

## 3. Send something

Trigger a password reset or a sign-up in your app. The email appears in **Mail** within a second, with its HTML, headers, attachments and any one-time code already extracted.

## 4. Call your webhooks

Add an endpoint and a rule in **Webhooks**, and SendMock posts every matching event to your app, shaped like the provider you choose. See [Webhooks](./webhooks.md).
