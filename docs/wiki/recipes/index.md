---
title: Recipes
description: Short tasks that use only what SendMock ships with. Each one solves a real problem in a few steps.
---

Each recipe starts from a real situation, uses only built-in features (no setup beyond pointing your app at SendMock), and ends with something you can see. Every recipe has a **Try it in the demo** part that works in the [live demo](/demo/) today.

| Recipe | You will |
| --- | --- |
| [Password reset email](./password-reset-email.md) | catch your app's reset email and follow its link |
| [Read a one-time code](./read-a-code.md) | read a code from an email, an SMS or Verify, by hand or in a test |
| [Bounces and complaints](./bounces-and-complaints.md) | make an email bounce or be marked as spam, and see your app react |
| [Failed SMS](./failed-sms.md) | make SMS fail with Twilio's real error codes |
| [Twilio Verify login](./twilio-verify-login.md) | log in with a code, then test an expired code and too many attempts |
| [Two-way SMS](./two-way-sms.md) | reply STOP as the contact and see your app's TwiML answer |
| [Reply by email](./reply-by-email.md) | answer a notification email and have the reply posted to your app |
| [Inbound email](./inbound-email.md) | receive email in your app the way Postmark sends it |
| [Stripe payment](./stripe-payment.md) | pay with a test card and handle Stripe's webhook |
| [SSLCommerz and bKash](./sslcommerz-bkash-checkout.md) | pay with a test wallet, get the redirect and the IPN |
| [Slack and push](./slack-and-push.md) | keep alerts and push notifications away from real people |
| [Replay a failed webhook](./replay-a-failed-webhook.md) | see why your handler failed, fix it, send it again |
| [Share your setup](./share-your-setup.md) | give your team and CI the same endpoints, rules and numbers |

When the built-ins are not enough, see [Advanced](../advanced/index.md).
