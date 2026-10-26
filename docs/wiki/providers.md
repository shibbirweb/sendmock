---
title: Supported providers
description: The provider APIs SendMock ships with, by product area. Each is a built-in you can change, remove or add to.
---

> **Coming with the provider phases.** Email provider APIs arrive in Phase 4, SMS providers in Phases 2 and 4, payment gateways in Phase 3. The demo shows them today.

SendMock ships with these providers **built in**. Each answers at the provider's real path, with the provider's real response and error shapes, so your app or its official SDK keeps working when you point it at SendMock. Plain SMTP works for every email library.

They are a starting point, not a fixed list:

- **Change a built-in** when your account differs from the default: another field name, path or response.
- **Remove** the ones you do not use.
- **Add your own** for a provider that is not listed, starting blank or from the closest built-in.
- **Reset to default** brings a changed or removed built-in back.

## Email (6 built in)

| Provider | What the built-in answers | Read more |
| --- | --- | --- |
| SendGrid | `POST /v3/mail/send` | [Mail](./mail/index.md) |
| Mailgun | `POST /v3/{domain}/messages` | [Mail](./mail/index.md) |
| Postmark | `POST /email`, `/email/batch` and `/email/withTemplate` | [Mail](./mail/index.md) |
| Resend | `POST /emails` and `/emails/batch` | [Mail](./mail/index.md) |
| Amazon SES | `POST /v2/email/outbound-emails` | [Mail](./mail/index.md) |
| Brevo | `POST /v3/smtp/email` | [Mail](./mail/index.md) |

## SMS (5 built in)

| Provider | What the built-in answers | Read more |
| --- | --- | --- |
| Twilio | the Messages API, Messaging Services, status callbacks and WhatsApp addresses | [SMS](./sms/index.md) |
| Twilio Verify | send and check verification codes | [Verify](./sms/verify.md) |
| Vonage | `POST /sms/json` and delivery receipts | [SMS](./sms/index.md) |
| Plivo | `POST /v1/Account/{auth_id}/Message/` | [SMS](./sms/index.md) |
| MessageBird | `POST /messages` | [SMS](./sms/index.md) |

## Payments (4 built in)

| Provider | What the built-in answers | Read more |
| --- | --- | --- |
| Stripe | Checkout Sessions, PaymentIntents, Refunds and signed webhook events | [Gateways](./payments/gateways.md) |
| PayPal | Orders, IPN postback and webhook signature verification | [Gateways](./payments/gateways.md) |
| SSLCommerz | session init, order validation, refunds and the signed IPN | [Gateways](./payments/gateways.md) |
| bKash | tokenized checkout: grant token, create, execute, query and refund | [Gateways](./payments/gateways.md) |

That is 15 built-in provider APIs; the landing page counts this list.

## Add or change a provider

- **Payment gateways:** see [Advanced: create a gateway](./advanced/payment-gateway.md), or open a built-in on the [Gateways](./payments/gateways.md) screen to change it.
- **Email and SMS providers:** they follow the same model as gateways, arriving with the provider phases.
- **The shape of the webhooks SendMock sends** (Slack, Discord, Telnyx and more): see [Advanced: templates](./advanced/templates.md).
