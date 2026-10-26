---
title: What can I test?
description: Start from your problem. Each row names the feature that solves it and where to read about it.
---

Find your situation, then follow the link. **Recipes** use only what SendMock ships with; **Advanced** pages show how to change or create things.

## Email

| I want to... | Use | Read |
| --- | --- | --- |
| see the emails my app sends without real inboxes or spamming anyone | Mail | [Mail](./mail/index.md) |
| click the reset or magic link, or read the code, in a test | extracted codes and links | [Recipe: password reset](./recipes/password-reset-email.md), [Recipe: read a code](./recipes/read-a-code.md) |
| check my HTML on phones and in Outlook and Gmail | HTML preview widths, Checks | [Reading and checks](./mail/reading-and-checks.md) |
| handle bounces, spam complaints and unsubscribes | magic addresses, Simulate | [Recipe: bounces and complaints](./recipes/bounces-and-complaints.md) |
| make my own test addresses always bounce or be rejected | custom outcome addresses | [Advanced: email outcome addresses](./advanced/email-outcome-addresses.md) |
| let users answer a notification by email | Reply as recipient, Inbound routes | [Recipe: reply by email](./recipes/reply-by-email.md) |
| receive inbound email the way Postmark, SendGrid or Mailgun sends it | built-in templates, rules | [Recipe: inbound email](./recipes/inbound-email.md) |
| send one real copy to a colleague, safely | Release with an allowlist | [Release](./mail/release.md) |
| test open tracking | opened events | [Settings: opened events](./settings.md#opened-events) |

## SMS and Verify

| I want to... | Use | Read |
| --- | --- | --- |
| test SMS login without a phone or provider credits | SMS, Verify | [Recipe: read a code](./recipes/read-a-code.md) |
| handle SMS that fail with Twilio's real error codes | Twilio test numbers | [Recipe: failed SMS](./recipes/failed-sms.md) |
| make my own QA numbers fail or arrive late | custom outcome numbers | [Advanced: SMS outcome numbers](./advanced/sms-outcome-numbers.md) |
| handle status callbacks (sent, delivered, failed) | status callbacks, delivery profiles | [Delivery and test numbers](./sms/delivery-and-test-numbers.md) |
| handle STOP and two-way conversations | Numbers, reply webhook, TwiML | [Recipe: two-way SMS](./recipes/two-way-sms.md) |
| test a Twilio Verify login, including expired codes and too many attempts | Verify, force outcome | [Recipe: Twilio Verify login](./recipes/twilio-verify-login.md) |
| test WhatsApp messages and media | WhatsApp channel, MMS | [Replies and WhatsApp](./sms/replies-and-whatsapp.md) |
| have my app's code format found | OTP patterns | [Advanced: OTP patterns](./advanced/otp-patterns.md) |

## Payments

| I want to... | Use | Read |
| --- | --- | --- |
| take test payments without a sandbox account, internet or a tunnel | Payments, the test checkout page | [Recipe: Stripe payment](./recipes/stripe-payment.md) |
| test a regional gateway whose sandbox is limited (SSLCommerz, bKash) | built-in gateways | [Recipe: SSLCommerz and bKash](./recipes/sslcommerz-bkash-checkout.md) |
| test declines, 3-D Secure, refunds and disputes | test cards, Simulate | [Payments](./payments/index.md), [Checkout page](./payments/checkout-page.md) |
| test a gateway SendMock does not ship | Gateways, Methods, Flows | [Advanced: create a gateway](./advanced/payment-gateway.md) |
| change the steps a checkout asks for | Flows | [Advanced: payment flow](./advanced/payment-flow.md) |

## Other HTTP calls

| I want to... | Use | Read |
| --- | --- | --- |
| keep Slack, Discord or push notifications away from real people | HTTP catcher presets | [Recipe: Slack and push](./recipes/slack-and-push.md) |
| see exactly what my app sent to a third-party API | HTTP catcher | [HTTP catcher](./http/index.md) |
| see how my app copes when an API is slow, rate limited or failing | response rules: delay, failure rate | [Advanced: catcher responses](./advanced/catcher-responses.md) |

## Webhooks

| I want to... | Use | Read |
| --- | --- | --- |
| test my provider webhook handlers without a public URL | endpoints, rules, templates | [Webhooks](./webhooks/index.md) |
| find out why my handler fails, fix it and try again | Deliveries, Replay | [Recipe: replay a failed webhook](./recipes/replay-a-failed-webhook.md) |
| check my handler verifies signatures and survives a secret rotation | endpoint secret, Rotate secret | [Endpoints](./webhooks/endpoints.md) |
| send an edge-case payload by hand | Composer, Edit and replay | [Composer and Saved](./webhooks/composer-and-saved.md) |
| send events in a format SendMock does not ship | custom templates | [Advanced: templates](./advanced/templates.md) |
| post alerts to my team's chat | Slack, Discord, Teams templates | [Templates](./webhooks/templates.md) |

## Everyday work

| I want to... | Use | Read |
| --- | --- | --- |
| find out why my app's email or SMS never arrived | Logs | [Logs](./logs.md) |
| see how my app copes when the mail server fails | Chaos | [Advanced: chaos](./advanced/chaos.md) |
| give my team and CI the same setup | seed file | [Recipe: share your setup](./recipes/share-your-setup.md) |
| run a whole flow again and again, in CI | scenarios | [Advanced: scenarios](./advanced/scenarios.md) |
| let an AI agent set all of this up | MCP, CLI, skill | [AI](./ai/index.md) |

## Browse by menu

[Overview](./overview.md) · [Mail](./mail/index.md) · [SMS](./sms/index.md) · [Verify](./sms/verify.md) · [HTTP](./http/index.md) · [Webhooks](./webhooks/index.md): [Endpoints](./webhooks/endpoints.md), [Rules](./webhooks/rules.md), [Inbound routes](./webhooks/inbound-routes.md), [Deliveries](./webhooks/deliveries.md), [Composer and Saved](./webhooks/composer-and-saved.md), [Templates](./webhooks/templates.md), [Variables](./webhooks/variables.md) · [Payments](./payments/index.md): [Gateways](./payments/gateways.md), [Methods](./payments/methods.md), [Flows](./payments/flows.md) · [Numbers](./numbers.md) · [Logs](./logs.md) · [Settings](./settings.md)
