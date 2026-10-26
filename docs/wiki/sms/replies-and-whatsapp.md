---
title: Replies and WhatsApp
description: Reply as the contact, see your app's reply webhook and TwiML answers, and use WhatsApp and media.
---

> Try it in the [demo](/demo/sms). Works in your install from Phase 3 (reply webhooks) and Phase 4 (WhatsApp).

## What it solves

- Your app answers incoming SMS (STOP, YES, a support chat), but you cannot text your dev machine.
- Your webhook verifies `X-Twilio-Signature` and answers with TwiML; you want to see both sides.
- Your Twilio number has a fallback URL; you want to see it used when the main URL fails.

## Reply as the contact

In a conversation, type in **Reply as recipient** and press **Send reply** (or `Enter`). **Attach files** adds images or files, which arrive as MMS or WhatsApp media. The message is stored as incoming and fires `sms.inbound`.

## Where the reply goes

Like a real provider, SendMock looks at the number the contact wrote to (set up in [Numbers](../numbers.md)):

1. If the number belongs to a **Messaging Service** whose inbound handling is "Send a webhook", the service's request URL is called.
2. Otherwise the **number's inbound URL** is called, in the format set on the number (Twilio, Vonage, Plivo, ... or native JSON), with `X-Twilio-Signature` for Twilio.
3. If that call fails, the **fallback URL** is tried.
4. A number without an inbound URL sends the message to **rules only** ([Webhooks > Rules](../webhooks/rules.md) on `sms.inbound`). With both set, both receive it.

## The result, on screen

- Under the incoming bubble: "Reply webhook 200", "Reply webhook 200, 1 TwiML reply", "Reply webhook failed: 11205 HTTP connection failure", "Fallback 200 after 11205", or "Rules only".
- If your app answered with TwiML `<Message>`, the answer appears in the conversation with a **TwiML reply** badge that jumps to the message it answers.
- **Message details > Reply webhook** shows each attempt (primary or fallback), the request with its form fields and headers (signature included), the response or the error with its Twilio code, the parsed TwiML verbs, and **Resend reply webhook**.

## WhatsApp and media

- Send to or from `whatsapp:+8801700000000` through the Twilio API and the conversation shows the WhatsApp badge and styling.
- Media (`MediaUrl` on Twilio, `media_urls` or inline `media` on the native API) shows as thumbnails and file chips in the bubble, with an MMS or Media badge and a media list in **Message details**.
- **Simulate read** on an outgoing message fires `sms.opened` and turns the ticks blue, for read receipts.

Step by step: [Recipe: two-way SMS](../recipes/two-way-sms.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| reply as the contact | [`sendmock sms inbound`](/cli/sms/#sms-inbound) | [`POST /api/v1/sms/inbound`](/api/sms/#postSmsInbound) | [`sendmock_sms_simulate_inbound`](/mcp/sms/#sendmock_sms_simulate_inbound) |
| resend the reply webhook | [`sendmock sms resend-reply-webhook <smsId>`](/cli/sms/#sms-resend-reply-webhook) | [`POST /api/v1/sms/{smsId}/reply-webhook/resend`](/api/sms/#postSmsBySmsIdReplyWebhookResend) | [`sendmock_sms_reply_webhook_resend`](/mcp/sms/#sendmock_sms_reply_webhook_resend) |
| simulate a read | [`sendmock sms open <smsId>`](/cli/sms/#sms-open) | [`POST /api/v1/sms/{smsId}/open`](/api/sms/#postSmsBySmsIdOpen) | [`sendmock_sms_open`](/mcp/sms/#sendmock_sms_open) |
| a media file | [`sendmock sms media <smsId> <mediaIndex>`](/cli/sms/#sms-media) | [`GET /api/v1/sms/{smsId}/media/{mediaIndex}`](/api/sms/#getSmsBySmsIdMediaByMediaIndex) | [`sendmock://sms/{smsId}/media/{mediaIndex}`](/mcp/sms/#resource-sms-smsid-media-mediaindex) |

## Related

- [Numbers](../numbers.md)
- [Advanced: numbers and Messaging Services](../advanced/numbers-and-services.md)
