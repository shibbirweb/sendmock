---
title: How it all connects
description: The one idea behind every screen, a map of how the menus feed each other, and three traced examples.
---

SendMock has many screens, but one idea explains all of them:

> **Everything your app sends becomes a message and an event. Everything SendMock sends back to your app is a delivery.**

## The map

```
                     ┌──────────── Settings change how capture behaves ────────────┐
                     │ outcome rules, profiles, chaos, OTP patterns, retention     │
                     ▼                                                             │
Your app ──SMTP, provider APIs, HTTP──►  CAPTURE                                   │
                                         Mail · SMS · Verify · HTTP · Payments     │
                                         (Logs keep the raw SMTP sessions and      │
                                          API requests behind each one)            │
                                              │                                    │
          Simulate buttons, Reply as          │ events: email.received,            │
          recipient, Verify force,  ─────────►│ sms.status, verify.started,        │
          payment Simulate, checkout page     │ http.captured, payment.succeeded   │
                                              ▼                                    │
                                         DELIVER                                   │
                Webhooks > Rules ──► Endpoint (Template + Variables + Secret) ─┐   │
                Inbound routes (incoming email) ───────────────────────────────┤   │
                Number reply webhook (incoming SMS, TwiML back) ───────────────┤   │
                SMS status callback (per message) ─────────────────────────────┤   │
                Gateway notification (IPN, payment webhook) ───────────────────┤   │
                Send to webhook, Composer, Saved (by hand) ────────────────────┘   │
                                              │                                    │
                                              ▼                                    │
                              Webhooks > Deliveries (log, retry, replay) ──► Your app
                                              │
                                              ▼
                              Overview and Webhooks > Overview (health), bell (alerts)
```

Read it top to bottom:

1. **Capture.** Your app talks to SendMock the way it talks to the real service. Each message lands in its menu (**Mail**, **SMS**, **Verify**, **HTTP Catcher**, **Payments**), and the raw conversation behind it (the SMTP session, the API request) lands in **Logs**.
2. **Events.** Every capture fires an event, such as `email.received`, `sms.status`, `verify.started`, `http.captured` or `payment.succeeded`. You can also make events happen yourself: **Simulate** a bounce, reply as the recipient, force a Verify outcome, refund a payment.
3. **Deliver.** Events turn into requests to your app. **Rules** pick events and send them to an **endpoint**, which shapes the request with a **template**, fills it with **variables** and signs it with its **secret**. Some deliveries do not need a rule, because a real provider would send them anyway: a message's status callback, a number's reply webhook, an inbound route, a gateway's payment notification.
4. **Log and replay.** Every request SendMock sends is in **Webhooks > Deliveries**, with the response your app gave, retries and **Replay**.
5. **Watch.** **Overview** and **Webhooks > Overview** summarise everything; the bell flags failures.
6. **Settings** decide how capture behaves: which addresses bounce, which numbers fail, how fast SMS are delivered, how payments settle, what counts as a one-time code.

## Menu by menu

| Menu | Gets from | Sends to |
| --- | --- | --- |
| [Overview](./overview.md) | counts and health from every menu | links into each menu |
| [Mail](./mail/index.md) | your app over SMTP or an email API; **Reply as recipient** | `email.*` events to Rules; incoming mail to Inbound routes; **Release** to a real SMTP relay; the session to Logs > SMTP |
| [SMS](./sms/index.md) | your app over the native, Twilio or Vonage API; replies typed in a conversation | `sms.*` events to Rules; status callbacks; the number's reply webhook (set in Numbers); the request to Logs > API requests |
| [Verify](./sms/verify.md) | your app over the Twilio Verify API | the code as an SMS (shown in SMS) or an email; `verify.*` events to Rules |
| [HTTP Catcher](./http/index.md) | any HTTP call your app makes to `/catch/<bin>` | the reply your bin's rules choose; `http.captured` to Rules; **Forward to URL** |
| [Webhooks](./webhooks/index.md) | events from every capture menu; gateway notifications from Payments | requests to your app, all logged in Deliveries |
| [Payments](./payments/index.md) | your app over a gateway API; the test checkout page | redirects to your app; notifications through the gateway's endpoint into Deliveries; `payment.*` events to Rules |
| [Numbers](./numbers.md) | your setup, as in a provider console | where incoming SMS go; which number a Messaging Service sends from |
| [Scenarios](./scenarios.md) | a scenario file | its steps call the same operations as every other menu, in order |
| [Logs](./logs.md) | the raw traffic behind Mail, SMS, Verify and Payments | links to the message each request created |
| [Settings](./settings.md) | your choices | how every capture menu behaves; the seed file for teams and CI |

## Three journeys, screen by screen

### A password reset email

1. Your app sends the reset email over SMTP. The session shows in **Logs > SMTP**.
2. The email shows in **Mail**, with the reset link and any code extracted.
3. The `email.received` event matches a rule in **Webhooks > Rules**, say "everything to `support@`".
4. The rule's endpoint (**Webhooks > Endpoints**) uses the Postmark inbound template, so the request looks like Postmark's.
5. **Webhooks > Deliveries** logs the request and your app's answer. A 500 can be fixed and replayed.

### An OTP login by SMS

1. Your app starts a verification with the Twilio Verify API. **SMS > Verify** shows the code and its countdown.
2. The code goes out as an SMS, which shows in **SMS** as a conversation.
3. Each status change (queued, sent, delivered) calls the message's status callback, logged in **Webhooks > Deliveries**.
4. In the Verify drawer you can **Expire** the code or force **Max attempts** to test the error paths.

### A checkout

1. Your app creates an SSLCommerz session. The payment shows in **Payments** as pending, and the API call in **Logs > API requests**.
2. The customer is sent to the **test checkout page**, which offers the gateway's methods. They pay with a test bKash number, OTP and PIN.
3. SendMock redirects the browser to your app's success URL with the gateway's fields, and posts the IPN through the gateway's notification endpoint; it shows in **Webhooks > Deliveries**.
4. Later, **Simulate > Refund** on the payment sends a second notification.

## Every menu page

[Overview](./overview.md) · [Mail](./mail/index.md): [Providers](./mail/providers.md) · [SMS](./sms/index.md): [Verify](./sms/verify.md), [Providers](./sms/providers.md) · [HTTP Catcher](./http/index.md) · [Webhooks](./webhooks/index.md): [Endpoints](./webhooks/endpoints.md), [Rules](./webhooks/rules.md), [Inbound routes](./webhooks/inbound-routes.md), [Deliveries](./webhooks/deliveries.md), [Composer and Saved](./webhooks/composer-and-saved.md), [Templates](./webhooks/templates.md), [Variables](./webhooks/variables.md) · [Payments](./payments/index.md): [Gateways](./payments/gateways.md), [Methods](./payments/methods.md), [Flows](./payments/flows.md) · [Numbers](./numbers.md) · [Scenarios](./scenarios.md) · [Logs](./logs.md) · [Settings](./settings.md)

## Where to go next

- [What can I test?](./use-cases.md) maps problems to these menus.
- [Recipes](./recipes/index.md) walk through common tasks.
