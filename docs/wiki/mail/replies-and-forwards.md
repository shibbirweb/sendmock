---
title: Replies and forwards
description: Act as the person your app emailed. Reply, reply all or forward, and the result arrives as incoming email for your app.
---

> Try it in the [demo](/demo/mail).

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

The composer opens under the header with the original already in the message box, so you can trim it like any text. **Send reply** works straight away: send it as prefilled, edited or with an empty message box. **Send forward** waits for a To address. `Ctrl+Enter` (`Cmd+Enter` on macOS) sends; `Esc` closes.

## Where it goes

Above the buttons, **Delivers to** lists everything that will receive the email before you send it: each URL or address an [inbound route](../webhooks/inbound-routes.md) forwards or notifies, in the order the routes run (ending at one that calls `stop()`), and each [webhook rule](../webhooks/rules.md) on `email.inbound` with its endpoint URL. Each line links to its route or rule. For a forward, the row follows the To address as you type.

When nothing would receive it, the row says **Nothing receives this yet**. To send replies to your app in one step:

1. Press **Send replies to your app**.
2. Enter your app's URL, for example `http://localhost:8000/webhooks/mail`.
3. Choose **Only mail to** this address (a `match_recipient()` route for exactly this address) or **Every incoming email** (a `catch_all()` route).
4. Press **Create route**.

The new route shows in the row and in Webhooks > Inbound routes, where **More options** opens the full editor.

Below it, the **Webhooks** row names the endpoints the email's `email.inbound` will reach through [webhook rules](../webhooks/rules.md#on-every-simulation), each opening in a new tab. **Change** picks other endpoints for this one reply or forward; **Delivers to** then lists them as "Chosen" in place of the rule matches, and **Use the rules** goes back.

## After sending

The toast lists each webhook request the email caused, with its URL and status. The status moves from pending to the HTTP status (or the error) as the request is answered, and each line opens the request in [Deliveries](../webhooks/deliveries.md). **Open** jumps to the new email, whose header lists the same requests. When nothing received it, both say so and link to Webhooks > Inbound routes.

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
| see where an incoming email would go | [`sendmock route match`](/cli/inbound-routes/#route-match) | [`POST /api/v1/inbound-routes/match`](/api/inbound-routes/#postInboundRoutesMatch) | [`sendmock_inbound_route_match`](/mcp/inbound-routes/#sendmock_inbound_route_match) |
| list the requests an email caused (`subject_id`) | [`sendmock webhook deliveries list`](/cli/webhook-deliveries/#webhook-deliveries-list) | [`GET /api/v1/webhooks/deliveries`](/api/webhook-deliveries/#getWebhooksDeliveries) | [`sendmock_webhook_delivery_list`](/mcp/webhook-deliveries/#sendmock_webhook_delivery_list) |

## Related

- [Inbound routes](../webhooks/inbound-routes.md)
- [Advanced: inbound routes](../advanced/inbound-routes.md)
