---
title: SMS
description: Twilio and Vonage compatible SMS and WhatsApp, with real test numbers and delivery callbacks.
---

> **The screens are in the [live demo](/demo/sms). The provider APIs arrive in Phase 2.**

![The SMS screen with a WhatsApp conversation open](./images/sms.jpg)

## Sending to SendMock

- **Twilio** and **Vonage** APIs at their real paths on the provider port `8026`.
- **Native send:** `POST /api/v1/sms` with `from`, `to` and `body`, plus optional `media_urls` or inline `media`.

Messages are grouped into conversations per contact and your number. Each bubble shows its segments and encoding, delivery status and any media.

## Test numbers

Twilio's official test numbers behave exactly as on Twilio, with the same error codes; for example `+15005550001` is an invalid number and `+15005550009` cannot receive SMS. Outcome rules add your own numbers that always fail or are delayed.

## Delivery status and callbacks

Outbound messages move through queued, sent and delivered (or failed) and call the status callback each time. In the message details you can set a status by hand and see every callback attempt.

## Replies

Type in the reply box to simulate the contact answering. SendMock calls the number's inbound webhook the way Twilio does, follows the fallback URL on failure and records TwiML replies in the conversation.
