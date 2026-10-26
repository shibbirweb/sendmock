---
title: Two-way SMS
description: Reply as the contact, have your app's webhook receive it in Twilio's format, and see its TwiML answer in the conversation.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/sms) today.

**The situation:** people answer your SMS: STOP to opt out, YES to confirm, or a question to support. Your app has a webhook for incoming SMS and answers with TwiML. You cannot text your laptop.

**You need:** your app's incoming SMS webhook URL, and the number your app sends from.

## Steps

1. In **Numbers**, press **Add number**: your sending number (for example `+15550001111`), **SMS** ticked.
2. Under **Inbound messages**, set **Webhook URL** to your app's handler, **Method** POST and **Format** Twilio. Save.
3. Send an SMS from your app from that number, then open the conversation in **SMS**.
4. In **Reply as recipient**, type `STOP` and press **Send reply**.
5. Your handler gets Twilio's form post (`From`, `To`, `Body`, `MessageSid` and the `X-Twilio-Signature` header). If it answers with TwiML `<Message>`, the answer appears in the conversation with a **TwiML reply** badge.

## What you should see

Under the STOP bubble, "Reply webhook 200" (and "1 TwiML reply" if your app answered). **Message details > Reply webhook** shows the request, your app's response and the parsed TwiML. If your handler failed, **Resend reply webhook** sends it again after your fix.

## Try it in the demo

1. Open [SMS](/demo/sms) and click the conversation with `+8801700000000`.
2. Type `Is the shop open?` in **Reply as recipient** and press **Send reply**.
3. The demo's app answers with TwiML: "Thanks! We got your message and will get back to you soon." appears with a **TwiML reply** badge.

## Next

- [Replies and WhatsApp](../sms/replies-and-whatsapp.md)
- [Advanced: numbers and Messaging Services](../advanced/numbers-and-services.md)
