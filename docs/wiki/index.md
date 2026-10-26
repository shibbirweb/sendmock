---
title: Introduction
description: What SendMock is, the problems it solves and where to start.
---

Your app sends email, SMS, payments and webhooks. Testing them for real is slow, costs money and is risky: a test email reaches a real customer, an OTP needs a real phone and credits, a payment needs a sandbox account and a public URL for its notifications, and a Slack alert lands in the team channel.

SendMock is a local stand-in for all of those services. It runs as one small binary (or a Docker image) on your machine:

1. **Point your app at SendMock** instead of the real SMTP server, SMS provider, payment gateway or API.
2. **See everything your app sent** in a web UI: every email, SMS, verification code, HTTP call and payment.
3. **Get the answers back** the way the real service would send them: delivery receipts, bounces, inbound replies, payment notifications and webhooks, signed like the provider signs them.

> **In development.** The web UI is ready to try as a [live demo with sample data](/demo/). The server arrives with the first beta in Phase 1; every page says which phase its part lands in.

## What it covers

| Area | What SendMock does | Read |
| --- | --- | --- |
| Email | catches mail over SMTP and the SendGrid, Mailgun, Postmark, Resend, SES and Brevo APIs; simulates delivery, bounces, complaints, opens and replies | [Mail](./mail/index.md) |
| SMS | Twilio and Vonage compatible APIs with Twilio's real test numbers, status callbacks, two-way replies and WhatsApp | [SMS](./sms/index.md) |
| Verify | Twilio Verify with codes you can read and outcomes you can force | [Verify](./sms/verify.md) |
| HTTP Catcher | a catcher for any other call your app makes (Slack, Discord, push, third-party APIs), answered the way you choose | [HTTP Catcher](./http/index.md) |
| Webhooks | sends events to your app automatically or by hand, shaped like the provider you use, with retries and replay | [Webhooks](./webhooks/index.md) |
| Payments | Stripe, PayPal, SSLCommerz and bKash test checkouts with real redirects and notifications, plus your own gateways | [Payments](./payments/index.md) |
| AI agents | a CLI, an MCP server and an agent skill, so an agent can set up and test everything | [AI](./ai/index.md) |

## Where to start

- **New here?** Follow [Getting started](./getting-started.md), then take the [Tour of the app](./tour.md).
- **Have a problem to solve?** Find it in [What can I test?](./use-cases.md).
- **Want to know how the parts fit?** Read [How it all connects](./how-it-connects.md).
- **Need something SendMock does not ship?** See [Advanced](./advanced/index.md) and [Build it with AI](./ai/build-with-ai.md).
