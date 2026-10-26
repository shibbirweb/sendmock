---
title: Inbound email
description: Receive email in your app the way Postmark, SendGrid or Mailgun posts it, with a built-in template and a rule.
---

> Works in your install from Phase 3 (native and Twilio formats) and Phase 4 (email provider formats). Try it in the [demo](/demo/webhooks/templates) today.

**The situation:** your app receives email through a provider's inbound webhook: support tickets from `support@`, invoices from a mailbox, replies. You want to test the handler with the provider's real payload, without a public URL.

**You need:** your app's inbound handler URL, for example `http://localhost:8000/webhooks/postmark-inbound`.

## Steps

1. In **Webhooks > Templates**, open the **Email providers** tab and click **Postmark: inbound** (or SendGrid Inbound Parse, or Mailgun routes).
2. Press **Use in new endpoint**. The endpoint sheet opens with the template chosen. Name it "Postmark inbound", set your handler's URL and press **Add endpoint**.
3. In **Webhooks > Rules**, press **Add rule**. Name it "Support inbox", pick the endpoint, tick `email.received`, and add a condition **To** **matches** `support@*`. Press **Add rule**.
4. Send an email to `support@yourapp.test` (from your app, or with any mail client pointed at `127.0.0.1:1025`).

## What you should see

A delivery in **Webhooks > Deliveries** whose request body is Postmark's inbound JSON (`From`, `To`, `Subject`, `TextBody`, `HtmlBody`, `Attachments`, ...), and your app's answer beside it. Your app created the ticket.

## Try it in the demo

1. Open [Webhooks > Templates](/demo/webhooks/templates), the **Email providers** tab, and click **Postmark: inbound**.
2. Press **Use in new endpoint**. Name it `Postmark inbound`, set the URL to `http://localhost:8000/webhooks/postmark-inbound` and press **Add endpoint**.
3. The endpoint appears in **Endpoints** with the Postmark template.

## Next

- [Templates](../webhooks/templates.md)
- [Rules](../webhooks/rules.md)
