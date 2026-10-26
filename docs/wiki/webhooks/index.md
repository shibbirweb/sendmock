---
title: Webhooks
description: How SendMock talks back to your app. The six parts of a webhook, how they fit, and the Webhooks overview screen.
---

> Try it in the [demo](/demo/webhooks/overview). Works in your install from Phase 3 (endpoints, rules, deliveries, templates, variables) and Phase 4 (inbound routes and more provider templates).

Real services call your app back: Postmark posts inbound email, Twilio posts delivery receipts and incoming SMS, SendGrid posts bounces, Stripe posts payment events. Locally they cannot reach you without a tunnel, and you cannot make them send what you need when you need it. SendMock sends those requests itself, shaped like the provider's and signed the way it signs them.

![The Webhooks overview with deliveries over time](../images/webhooks.jpg)

## What it solves

- **Testing webhook handlers without a public URL or tunnel**, and without waiting for the provider.
- **Your production handler, unchanged:** the request has the provider's fields, content type and signature.
- **Failures you can fix and replay:** every request and your app's answer are logged; replay after the fix. See [Recipe: replay a failed webhook](../recipes/replay-a-failed-webhook.md).
- **Signature checks:** each endpoint has its own secret, which you can rotate to test your verification.
- **Team alerts:** send events to Slack, Discord or Teams.

## The six parts

| Part | Is | Page |
| --- | --- | --- |
| **Event** | something that happened: `email.received`, `sms.status`, `payment.succeeded`, ... | [Events](#events) below |
| **Rule** | "send these events, when they match this filter, to this endpoint" | [Rules](./rules.md) |
| **Endpoint** | where to send (URL, method), how to shape it (template), how to sign it (secret), and retries | [Endpoints](./endpoints.md) |
| **Template** | the request's shape: the provider's fields, headers and signature | [Templates](./templates.md) |
| **Variable** | a value a template reads: an auth token, a tenant id, a random id | [Variables](./variables.md) |
| **Delivery** | one request SendMock sent, with your app's answer, retries and replay | [Deliveries](./deliveries.md) |

```
event ──► rule (filter) ──► endpoint ──► template + variables + secret ──► request ──► your app
                                                                               │
                                                             delivery log ◄────┘ (answer, retries, replay)
```

Some deliveries skip the rule, because the real provider would send them anyway: an SMS's status callback, a number's reply webhook ([Numbers](../numbers.md)), an incoming email's [inbound route](./inbound-routes.md), and a gateway's payment notification ([Gateways](../payments/gateways.md)). They all land in the same delivery log.

You can also send by hand: **Send to webhook** on any email, SMS or captured request, or the [Composer](./composer-and-saved.md).

## How it connects

| Gets from | Sends to |
| --- | --- |
| events from [Mail](../mail/index.md), [SMS](../sms/index.md), [Verify](../sms/verify.md), [HTTP](../http/index.md) and [Payments](../payments/index.md) | requests to your app |
| simulations: Simulate, Reply as recipient, Verify force, payment Simulate | [Deliveries](./deliveries.md), the [Overview](../overview.md) and the bell |

## Use it

1. In **Endpoints**, press **Add endpoint**, name it, set the URL of your app's handler (for example `http://localhost:8000/webhooks/mail`), and in the **Request** tab pick the template your app expects.
2. Press **Send test** on the endpoint to check your app answers 2xx.
3. In **Rules**, press **Add rule**, pick the endpoint and the events, and save.
4. Make the event happen (send an email, an SMS, a payment). The request shows in **Deliveries** with your app's answer.

## Events

| Event | Fires when |
| --- | --- |
| `email.received` | your app sent an email to SendMock |
| `email.inbound` | an incoming email arrived (a simulated reply or forward, or mail to an inbound domain) |
| `email.opened` | an email was opened in the UI, or an open was simulated |
| `email.delivered`, `email.deferred`, `email.bounced`, `email.complained`, `email.unsubscribed` | a delivery outcome was simulated ([Outcomes](../mail/outcomes.md)) |
| `email.released` | an email was released to a real SMTP relay |
| `sms.sent` | your app sent an SMS or WhatsApp message |
| `sms.status` | a message's status changed |
| `sms.opened` | an SMS was viewed in the UI, or a read was simulated |
| `sms.inbound` | the contact replied |
| `verify.started`, `verify.checked`, `verify.expired` | Twilio Verify activity |
| `http.captured` | the HTTP catcher recorded a request |
| `payment.*`, `checkout.*` | payments were created, succeeded, failed, refunded, disputed; checkouts completed or expired |
| `webhook.failed` | a delivery used up its retries (useful for alerts) |
| `test.ping` | **Send test** on an endpoint |

## Everything on this screen

### The Webhooks overview screen

The first Webhooks screen shows how deliveries are going, live.

- **Range:** 24 hours (hourly) or 7 days (daily), and **All endpoints** or one endpoint. Both are kept in the URL.
- **Stat tiles:** deliveries, success rate, p50 and p95 latency, retries and render failures.
- **Deliveries over time:** stacked columns for succeeded, retrying and failed, with a tooltip (hover or arrow keys) that adds p50 and p95 latency, and **Show as table**.
- **By endpoint:** deliveries, success-rate meter, latency, retries and top failure codes per endpoint; click a row to narrow the screen to it.
- **Top failure codes:** each code or error with its count and share, linking to the failed deliveries.
- **Recent failures:** each linking to its delivery.

### Signing

SendMock's own JSON follows [Standard Webhooks](https://www.standardwebhooks.com/): `webhook-id`, `webhook-timestamp` and `webhook-signature` headers with the endpoint's `whsec_` secret, so the official libraries verify it. Provider templates sign the provider's way (`X-Twilio-Signature`, Mailgun's `signature` field, `Stripe-Signature`, ...).

## Customize

- Shape requests for any service: [Advanced: templates](../advanced/templates.md) and [Advanced: request editor](../advanced/request-editor.md).
- Values that change per send or come from the message: [Advanced: variables](../advanced/variables.md).
- Exact filters: [Advanced: rules and filters](../advanced/rules-and-filters.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| health | [`sendmock webhook metrics`](/cli/webhook-deliveries/#webhook-metrics) | [`GET /api/v1/webhooks/metrics`](/api/webhook-deliveries/#getWebhooksMetrics) | [`sendmock_webhook_metrics`](/mcp/webhook-deliveries/#sendmock_webhook_metrics) |
| recent events | [`sendmock events tail`](/cli/automation/#events-tail) | [`GET /api/v1/events/recent`](/api/automation/#getEventsRecent) | [`sendmock_events_recent`](/mcp/automation/#sendmock_events_recent) |
| wait for a delivery | [`sendmock webhook deliveries wait`](/cli/test-helpers/#webhook-deliveries-wait) | [`GET /api/v1/wait/webhook`](/api/test-helpers/#getWaitWebhook) | [`sendmock_webhook_delivery_wait`](/mcp/test-helpers/#sendmock_webhook_delivery_wait) |

## Related

- [How it all connects](../how-it-connects.md)
- [Recipe: inbound email](../recipes/inbound-email.md)
