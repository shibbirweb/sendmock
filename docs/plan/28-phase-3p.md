# 28. Phase 3P: Payment gateway backend

Phase 3P makes payments real: the native payments API and the hosted test checkout, the test card and wallet tables with the real-card safety rule, gateways, methods and flows stored in the database and editable, notifications rendered from each gateway's definition and delivered through the webhook engine, after-payment operations, and Stripe, PayPal and SSLCommerz emulated at their real paths on the provider port. The Payments screens and Settings > Payments switch to live data ([11](11-roadmap.md#phase-3p-payment-gateway-about-2-weeks), [17](17-payments.md)).

## Goal and done-when

**Done when** (from [11](11-roadmap.md#phase-3p-payment-gateway-about-2-weeks)): apps using the official Stripe SDK, PayPal Orders and SSLCommerz complete a payment, receive and verify the IPN or webhook, validate the order, and handle a decline and a refund, all offline. In full:

- every Phase 3P item in [PROGRESS.md](PROGRESS.md) is ticked and the Phase 3P criteria of [PY](acceptance/08-payments.md) have passing tests that name them;
- the done-when check runs in CI against a release binary with outbound traffic blocked (PY-01.3);
- the live UI suite shows the Payments screens, the test checkout page, Payments > Gateways, Methods and Flows, Settings > Payments and the Overview's Payments tile with real data and no failing calls.

## Workstreams and order

All on `feat/phase-0` in #48, a commit per workstream, as for Phases 1 to 3.

| # | Workstream | Criteria | Depends on |
|---|------------|----------|------------|
| W1 | Flows and methods: migration (`payment_flows`, `payment_methods`, built-ins shipped as JSON shared with the mock's fixtures, a stored row only for an edited built-in or a custom item), `PaymentFlowRepository`, `PaymentMethodRepository`; list, create, update, delete, reset; step operations (add, move, remove, update one step); `GET /payments/step-types` and `GET /payments/flow-variables`; the flow and method validation the mock has (`validate-payment-flow.ts`, `validate-payment-method.ts`) | PY-12.1, PY-12.5 (flows, methods), PY-12.6, PY-12.7 | |
| W2 | Gateways: migration (`payment_gateways`), `PaymentGatewayRepository`; list, create (from a built-in or blank), update, delete, reset; merchant credentials masked with reveal (`GET .../credentials/{credentialName}`, no MCP tool); the gateway validation; `POST /payments/gateways/{gatewayKey}/preview` rendering redirect fields and the notification with `minijinja` (template functions `uuid`, `random_hex`, `now_iso`, `stripe_signature`) and a save with template errors refused | PY-12.2, PY-12.4, PY-12.5 (gateways) | W1 |
| W3 | Payments core: migration (`payments`, `payment_events`), `PaymentRepository`; the test card and wallet tables (`GET /payments/test-cards`) with the Luhn check and the real-card refusal that stores and logs nothing; amounts in minor units with currency exponents (JPY 0, BDT, INR, USD, EUR 2); `POST /payments` (native), `GET /payments` (paged, filters) and `GET /payments/{paymentId}` with the timeline | PY-01.1, PY-01.2, PY-02.1, PY-02.3 | W1 |
| W4 | Hosted checkout: checkout sessions on the payment, `POST /payments/checkout`, `GET /checkout-sessions/{sessionId}` and `POST .../complete` (`pay`, `decline`, `cancel`, `delay`, `require_three_ds`, `three_ds_approve`, `three_ds_fail`), flows run step by step against the method's test values, the outcome profile settings, redirects built from the gateway definition (GET or POST), expired and closed sessions; the `/pay/{sessionId}` page live with its TEST MODE banner | PY-02.2, PY-03.1 to PY-03.4, PY-12.3 | W2, W3 |
| W5 | Notifications and events: `payment.*` and `checkout.*` events on the bus (and so to webhook rules), the gateway's notification rendered from its definition and queued as a delivery to its notification endpoint (retries, log, replay), `POST /payments/{paymentId}/notify`, the payment templates and their provider fixtures | PY-08.1 to PY-08.3 | W4 |
| W6 | After-payment operations: `POST /payments/{paymentId}/simulate` (`succeed`, `decline`, `refund` full or partial, `capture`, `void`, `expire`, `dispute`, `resolve_dispute`) with the `409` and `422` rules, events and notifications | PY-07.1, PY-07.2, PY-09.3 | W5 |
| W7 | Stripe on the provider port: Checkout Sessions, PaymentIntents (create, confirm, capture, cancel), Refunds and the retrieve endpoints in Stripe's object and error shapes, the test card decline codes, `Stripe-Signature` that `stripe.webhooks.constructEvent` accepts; the official Node SDK in CI | PY-04.1 to PY-04.4 | W6 |
| W8 | PayPal: Orders v2 (create, approve on the checkout page, capture), refunds, webhooks with transmission headers and `verify-webhook-signature`, classic IPN with the `_notify-validate` postback | PY-05.1 to PY-05.3 | W6 |
| W9 | SSLCommerz: session init, IPN with `verify_sign` and `verify_key`, the order validation API, refund and transaction query, the success, fail and cancel POST redirects | PY-06.1 to PY-06.5 | W6 |
| W10 | Custom gateways' wire APIs from their definition (session init answers the checkout URL, validation answers from the payment), `GET /wait/payment`, the seed file's payment sections (gateways, methods, flows; credentials as `${ENV}`), CLI and MCP `payments` surfaces checked against the catalogue | PY-11.1 to PY-11.3, PY-12.3 (custom) | W7 to W9 |
| W11 | Screens live: Payments list and detail, the Simulate menu, the checkout page, Gateways, Methods, Flows, Settings > Payments and the Overview tile in the live UI suite | PY-09.1 to PY-09.5 | W10 |
| W12 | Done-when: Stripe Node SDK, PayPal Orders and SSLCommerz apps in `examples/payments/` complete a payment, verify the notification, validate the order, and handle a decline and a refund, in CI against a release binary with outbound traffic blocked | PY-01.3, PY-01.4, Phase 3P done-when | W11 |

Large workstreams are split (W1a, W1b, ...) when they are started, as in Phase 3.

## Design notes

- **Crate:** the domain goes into a new `sendmock-payments` crate (layer 2): money and currencies (`MoneyAmount` value object in minor units), the test instrument tables and the real-card check, the flow step catalogue and the flow runner (the checkout's state machine as a Strategy per step type), and the provider signing schemes. Operations live in `sendmock-ops/src/payments/`, storage in `sendmock-store` (`PaymentFlowRepository`, `PaymentMethodRepository`, `PaymentGatewayRepository`, `PaymentRepository`).
- **Built-ins as data:** the shipped flows, methods and gateways are JSON in `crates/sendmock-ops/builtin/`, generated from the same source as the mock's fixtures so both ship identical definitions; a database row exists only for an edited built-in (its whole definition, so Reset deletes the row) or a custom item, as SMS providers do ([22](22-configurable-providers.md)).
- **Real cards never stored:** the real-card refusal happens before anything is written: the request log stores a redacted body for payment requests and the error names no digits (PY-01.1); a stored method keeps brand, last 4 and expiry only (PY-01.2).
- **Notifications are deliveries:** a gateway's notification is a webhook delivery to its notification endpoint, rendered from the gateway's body and header templates when it is queued (as W4c of Phase 3 renders endpoint requests), so retries, the log, replay and `notify` (resend) come from the Phase 3 engine.
- **Provider port:** Stripe, PayPal and SSLCommerz are provider adapters (Adapter pattern) registered in the provider registry beside Twilio and Vonage, at their real paths and under `/providers/<key>/...`.
