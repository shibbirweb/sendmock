---
title: Email
description: Catch every email over SMTP or a provider API, read it, check it and simulate what happens next.
---

> **The screens are in the [live demo](/demo/mail). SMTP and the provider APIs arrive in Phase 1.**

![The Mail screen with an email open on its HTML preview](./images/mail.jpg)

## Sending to SendMock

- **SMTP** on `127.0.0.1:1025`, any username and password; every address is accepted.
- **Provider APIs** at their real paths on the provider port `8026`: SendGrid, Mailgun, Postmark, Resend, Amazon SES and Brevo.
- **Native send:** `POST /api/v1/send` with JSON and optional base64 attachments.

## Reading mail

The list is newest first with search (`from:`, `to:` and `tag:` prefixes) and chips for unread, attachments, inbound and each source. Press `j` and `k` to move through it.

An open email has tabs for the HTML preview (desktop, tablet and phone widths, remote images off until you load them), plain text, source, headers, attachments, the MIME tree, checks, the delivery timeline and template data. One-time codes and links are pulled out and shown with a copy button.

## Checks

**Checks** reports HTML and CSS support across email clients, broken links and images, a spam score, and List-Unsubscribe and one-click unsubscribe headers.

## Simulating what happens next

- **Simulate** marks an email delivered, deferred, bounced, complained or unsubscribed, and fires the matching webhook event.
- **Reply** and **Forward** act as the recipient: the result arrives as inbound email and is routed by [inbound routes](./webhooks.md#inbound-routes).
- **Release** sends a copy through a real SMTP relay, only to addresses on your allowlist.

Outcome rules in Settings make particular addresses always bounce or defer, so your tests can depend on them.
