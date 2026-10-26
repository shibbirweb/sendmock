---
title: Reply by email
description: Answer a notification email as its recipient and have the reply posted to your app, as Mailgun Routes would.
---

> Works in your install from Phase 4. Try it in the [demo](/demo/mail) today.

**The situation:** your app emails ticket updates from `reply+<ticket>@reply.app.test`, and people answer by email. In production, Mailgun receives the reply and posts it to your app. You want to test that handler locally.

**You need:** your app's inbound mail handler URL.

## Steps

1. In **Settings > Email**, add `reply.app.test` to **Inbound domains** and save.
2. In **Webhooks > Inbound routes**, press **Add route**. Description "Ticket replies"; **Match recipient** with the pattern `reply\+(?P<ticket>.+)@reply.app.test`.
3. The route starts with a **Forward to URL** action: set its target to your handler's URL. Then **Add action** > **Stop**, and press **Add route**.
4. In your app, trigger a ticket notification. Open it in **Mail**, press **Reply** (`R`), write "Thanks, that fixed it." above the quoted text, and press **Send reply**.
5. Your handler gets Mailgun's form post. `stripped-text` holds only "Thanks, that fixed it.", and the ticket id is in the recipient.

## What you should see

The reply in Mail with an Inbound badge, its **Timeline** saying "Forwarded by route Ticket replies to ...", and the request in **Webhooks > Deliveries**.

## Try it in the demo

1. Open [Mail](/demo/mail) and click **Your verification code**.
2. Press **Reply**, type `Got it, thanks.` and press **Send reply**.
3. Press **Open** on the toast, then the **Timeline** tab: it shows "Forwarded by route Replies to no-reply to http://localhost:8000/webhooks/mail/inbound (200)".

## Next

- [Replies and forwards](../mail/replies-and-forwards.md)
- [Advanced: inbound routes](../advanced/inbound-routes.md)
