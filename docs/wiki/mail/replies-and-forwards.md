---
title: Replies and forwards
description: Act as the person your app emailed. Reply, reply all or forward, and the result arrives as incoming email for your app.
---

> Try it in the [demo](/demo/mail). Works in your install from Phase 4.

Many apps let people answer an email: a support ticket notification, a comment digest, a "reply to this message" address like `reply+42@reply.app.test`. In production the provider (Mailgun, SendGrid, Postmark) receives that reply and posts it to your app. SendMock does the same locally.

## What it solves

- Your "reply by email" feature can only be tested in production.
- You need the reply's new text without the quoted original (`stripped-text`).
- A forwarded email should open a ticket in your support inbox.

## Reply, reply all and forward

Open an email your app sent and press:

- **Reply** (`R`): from one of the original recipients, to the original `Reply-To` (or `From`), with `Re:` and the original quoted below, like a mail client.
- **Reply all** (`Shift+R`, only with more than one recipient): as Reply, with the other recipients in `Cc`.
- **Forward** (`F`): to an address you type (the inbound domains from Settings are suggested), with `Fwd:`, the forwarded-message block and, by default, the attachments.

The composer opens under the header with the original already in the message box, so you can trim it like any text. `Ctrl+Enter` (`Cmd+Enter` on macOS) sends; `Esc` closes. After sending, a toast offers **Open** to jump to the new email.

## What happens next

1. The reply is stored as an **incoming** email: it has the Inbound badge and a "Reply to" or "Forward of" link back to the original. The original lists it under **Replies and forwards** and in its **Timeline**.
2. SendMock fires `email.inbound` (not `email.received`, so rules on mail your app sends never loop on replies).
3. [Inbound routes](../webhooks/inbound-routes.md) decide where it goes, as Mailgun Routes do: for example, `match_recipient("reply\+(?P<ticket>.+)@reply.app.test")` posts it to your app in Mailgun's format with `stripped-text` holding only the new text.
4. The post shows in [Deliveries](../webhooks/deliveries.md), and in the email's **Timeline** as "Forwarded by route ...".

## Other incoming mail

- Mail that arrives over SMTP for an **inbound domain** (set in [Settings > Email](../settings.md#email), for example `reply.app.test`) is treated as incoming too.
- `POST /api/v1/emails/inbound` creates any incoming email, for example a fresh message to `support@inbound.app.test`.

Step by step: [Recipe: reply by email](../recipes/reply-by-email.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| reply | [`sendmock email reply <emailId>`](/cli/email/#email-reply) | [`POST /api/v1/emails/{emailId}/reply`](/api/email/#postEmailsByEmailIdReply) | [`sendmock_email_reply`](/mcp/email/#sendmock_email_reply) |
| forward | [`sendmock email forward <emailId>`](/cli/email/#email-forward) | [`POST /api/v1/emails/{emailId}/forward`](/api/email/#postEmailsByEmailIdForward) | [`sendmock_email_forward`](/mcp/email/#sendmock_email_forward) |
| create an incoming email | [`sendmock email inbound`](/cli/email/#email-inbound) | [`POST /api/v1/emails/inbound`](/api/email/#postEmailsInbound) | [`sendmock_email_inbound`](/mcp/email/#sendmock_email_inbound) |
| list routes | [`sendmock route list`](/cli/inbound-routes/#route-list) | [`GET /api/v1/inbound-routes`](/api/inbound-routes/#getInboundRoutes) | [`sendmock_inbound_route_list`](/mcp/inbound-routes/#sendmock_inbound_route_list) |

## Related

- [Inbound routes](../webhooks/inbound-routes.md)
- [Advanced: inbound routes](../advanced/inbound-routes.md)
