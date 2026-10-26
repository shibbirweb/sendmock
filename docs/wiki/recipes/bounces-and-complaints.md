---
title: Bounces and complaints
description: Make an email bounce or be marked as spam, by hand or with a magic address, and send the event to your app in your provider's format.
---

> Works in your install from Phase 3 (native events) and Phase 4 (provider formats). Try it in the [demo](/demo/mail) today.

**The situation:** your app should stop emailing addresses that bounce and people who mark it as spam, and maybe show "email bounced" to an admin. Real bounces are hard to produce, so this code is rarely tested.

**You need:** your app's mail settings pointing at SendMock, and your app's bounce webhook handler URL.

## Steps

1. **Send the event to your app.** In **Webhooks > Endpoints**, press **Add endpoint**, set your handler's URL, and in **Request** pick your provider's event template (for example "SendGrid: Event Webhook"). Then in **Webhooks > Rules**, add a rule for that endpoint with the events `email.bounced` and `email.complained`.
2. **Bounce by address.** In your app, send an email to `bounce@example.test`. It hard bounces by itself (`550 5.1.1 user unknown`). `complaint@example.test` is delivered and then marked as spam.
3. **Or bounce by hand.** Open any email in **Mail**, press **Simulate** and pick **Hard bounce**, **Soft bounce** or **Spam complaint**.
4. Open **Webhooks > Deliveries**: the event was posted to your handler, and your app's answer is there.

## Which addresses do what

`delivered@`, `bounce@`, `bounce+hard@`, `bounce+soft@` and `complaint@` work on any domain; the Amazon SES simulator addresses work too. The full table is on [Outcomes](../mail/outcomes.md). **Test an address** in **Settings > Email** tells you what an address will do.

## What you should see

The email with a Bounced or Complained badge and a **Timeline** entry, a delivery in **Deliveries**, and your app marking the address as suppressed.

## Try it in the demo

1. In [Settings > Email](/demo/settings?section=email), type `bounce+hard@shop.test` in **Test an address**: it says "Magic address: Hard bounce (550 5.1.1)".
2. Open [Mail](/demo/mail), click **Reset your password**, press **Simulate** and pick **Hard bounce**.
3. The **Timeline** tab lists the bounce.

## Next

- [Advanced: email outcome addresses](../advanced/email-outcome-addresses.md): your own addresses that always bounce.
- [Outcomes](../mail/outcomes.md)
