---
title: Introduction
description: What SendMock is and what it does for your app.
---

SendMock is a local sandbox for everything your app sends: email, SMS, payments and webhooks. It runs as one small binary (or a Docker image), catches messages from any language, shows them in a web UI and calls your webhooks.

> **In development.** The web UI is ready to try as a [live demo with sample data](/demo/). The server arrives with the first beta in Phase 1; pages say which phase each part lands in.

## What it does

- **Email:** a catch-all SMTP server plus SendGrid, Mailgun, Postmark, Resend, SES and Brevo compatible HTTP APIs. See [Email](./email.md).
- **SMS and Verify:** Twilio and Vonage compatible APIs, Twilio Verify, Twilio's real test numbers and delivery status callbacks. See [SMS](./sms.md) and [Verify](./verify.md).
- **Webhooks:** automatic rules or manual sends, provider-shaped payload templates, variables, retries and replay, signed with Standard Webhooks. See [Webhooks](./webhooks.md).
- **HTTP catcher:** a bin for any HTTP call your app makes, with the responses you choose. See [HTTP catcher](./http-catcher.md).
- **Payments:** Stripe, PayPal, SSLCommerz and bKash test checkouts with real redirects and notifications. See [Payments](./payments.md).
- **AI agents:** a CLI, an MCP server and an agent skill. See [MCP and AI](./mcp-and-ai.md).

## Next steps

- [Getting started](./getting-started.md)
- [Connect your app](./connect/index.md)
