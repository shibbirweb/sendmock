---
title: Numbers and Messaging Services
description: Set up numbers with reply webhooks and fallbacks, and Messaging Services with sender pools, as in a provider console.
---

> Works in your install from Phase 3 (number webhooks) and Phase 4 (the full registry). Try it in the [demo](/demo/numbers) today.

## When you would

- Your app receives replies on more than one number (a support line, a marketing line), each with its own handler.
- Your production number has a fallback URL, and you want to see it used.
- Your app sends with a Twilio `MessagingServiceSid`.

## Steps: a number with a reply webhook and a fallback

1. In **Numbers**, press **Add number**. **Number** `+15550001111`, **Label** `Support line`, channels **SMS** and **WhatsApp**.
2. Under **Inbound messages**: **Webhook URL** `http://localhost:8000/sms/inbound`, **Method** POST, **Fallback URL** `http://localhost:8000/sms/fallback`, **Format** Twilio.
3. **Default status callback:** `http://localhost:8000/sms/status` (used when a send from this number gives none).
4. Save. Stop your app and reply to a conversation with this number: the result line says "Reply webhook failed: 11205 HTTP connection failure", then the fallback is tried.

## Steps: a Messaging Service

1. Open the **Messaging Services** tab and press **New Messaging Service**.
2. Name it (`Acme notifications`), tick the numbers in the **Sender pool** (a number already in another service moves here, and the list says so).
3. Pick the inbound handling: **Send a webhook** (the service's **Request URL** and **Fallback URL**), **Defer to sender's webhook** (each number's own URL) or **Drop the message**.
4. Save. Copy the SID (`MG...`) into your app. Sends with that `MessagingServiceSid` pick a number from the pool, shown on each message.

## Rules and numbers together

A number without an inbound URL sends replies to rules only. With both an inbound URL and a rule on `sms.inbound`, both receive the reply, and the number sheet says so.

## In the seed file

```toml
[[numbers]]
number = "+15550001111"
label = "Support line"
channels = ["sms", "whatsapp"]
inbound_url = "http://localhost:8000/sms/inbound"
inbound_template = "twilio.inbound_sms"
status_callback = "http://localhost:8000/sms/status"

[[messaging_services]]
sid = "MG00000000000000000000000000000001"
name = "Acme notifications"
inbound_mode = "webhook"
inbound_url = "http://localhost:8000/sms/inbound"
```

## Related

- [Numbers](../numbers.md)
- [Recipe: two-way SMS](../recipes/two-way-sms.md)
