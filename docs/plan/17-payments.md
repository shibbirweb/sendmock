# 17. Payment Gateway Emulation

`mss` also acts as a **fake payment gateway**. Apps create payments or checkout sessions against provider-compatible APIs (Stripe, PayPal, SSLCommerz, bKash, Razorpay, ...), the user "pays" on an mss-hosted test checkout page (or the API confirms with a test card), and mss sends the gateway's callbacks: redirects to the app's success/fail/cancel URLs plus **IPN / webhook events**, signed like the real provider. Refunds, captures, disputes and subscriptions can be simulated too.

This lets developers build and test the whole payment flow, including IPN handlers, signature checks, order validation and failure paths, locally and offline, with no sandbox account and no internet.

## Why

- Real sandboxes need accounts, keys, internet and a public URL (tunnel) for IPN; they are slow to reset and hard to drive into edge cases.
- Regional gateways (SSLCommerz, bKash, Nagad, Razorpay) have limited or flaky sandboxes, and their IPN/validation steps are where most integration bugs are.
- Payment events fit the existing webhook engine: the same rules, templates, variables, signing, retries, replay and delivery log apply.

## Safety rules (non-negotiable)

- **No real money, ever.** mss never contacts a real gateway or card network.
- **Only test card numbers are accepted.** Any card number that passes the Luhn check but is not a documented test card is rejected with "Use a test card" and is **never stored or logged** (not even masked). This protects developers who paste a real card by mistake.
- Stored payment methods are reduced to brand, last 4 and expiry; no full PAN or CVC is ever kept.
- Hosted checkout pages show a permanent "TEST MODE: no real payment" banner.

## Flows

### 1. Hosted checkout (redirect flow)

1. The app creates a session (e.g. Stripe `POST /v1/checkout/sessions`, PayPal `POST /v2/checkout/orders`, SSLCommerz `POST /gwprocess/v4/api.php`, bKash create payment).
2. mss returns the provider-shaped response with a redirect URL to the **mss test checkout page** (`http://127.0.0.1:8025/pay/{sessionId}`).
3. The checkout page shows the order (amount, currency, items, merchant) and test controls: **Pay successfully**, **Decline** (choose a reason: insufficient funds, expired card, incorrect CVC, generic decline, fraud), **Cancel**, **Require 3-D Secure** (then approve or fail the challenge), and **Delay** (stay pending, settle later). Card, wallet (bKash/Nagad style PIN/OTP screens) or bank options follow the provider being emulated.
4. mss redirects the browser to the app's `success_url` / `fail_url` / `cancel_url` with the provider's parameters (GET or POST, as the provider does).
5. mss fires the provider's **server-to-server notification** (IPN / webhook) to the app, signed, through the webhook engine (retries, delivery log, replay).
6. The app can call the provider's **validation / retrieve API** on mss (e.g. SSLCommerz order validation with `val_id`, PayPal IPN postback `cmd=_notify-validate`, Stripe `GET /v1/checkout/sessions/{id}`), which answers consistently with what happened.

### 2. Direct API (server-side) payments

Payment intents / orders created and confirmed via API with **test cards or test wallets**, e.g. Stripe `POST /v1/payment_intents` + `confirm` with `pm_card_visa` or a test card number; the outcome follows the test card table below.

### 3. After-payment operations

- **Authorize then capture** (manual capture), **void / cancel**.
- **Refunds**: full and partial, instant or pending then succeeded/failed.
- **Disputes / chargebacks**: open, needs response, won, lost.
- **Subscriptions** (Stripe-style): create, trial, renew (simulated clock advance), payment failure and dunning, cancel. (Phase 4+)
- All available from the UI ("Simulate" menu on a payment), REST API, CLI and MCP.

## Provider emulation

Served on the provider port at the real paths (same mechanism as SMS and email providers) and under `/providers/<name>/...`.

| Provider | APIs emulated | Notifications | Phase |
|----------|---------------|---------------|-------|
| **Stripe** | Checkout Sessions, PaymentIntents (create, confirm, capture, cancel), Refunds, Customers (basic), retrieve endpoints | Webhook events (`checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, ...) with `Stripe-Signature` | 3P |
| **PayPal** | Orders v2 (create, approve via checkout page, capture), Refunds | Webhooks (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, ...) with verify-webhook-signature endpoint; classic IPN form post with `_notify-validate` postback | 3P |
| **SSLCommerz** | Session init (`gwprocess/v4/api.php`), order validation API, refund API, transaction query | IPN POST with `val_id`, `status` (`VALID`, `FAILED`, `CANCELLED`), `verify_sign`, `verify_key`; success/fail/cancel POST redirects | 3P |
| **bKash** (tokenized checkout) | grant token, create payment, execute payment, query, refund | callback redirect with `paymentID` and `status` (`success`, `failure`, `cancel`) | 4 |
| **Razorpay** | Orders, payments capture, refunds; checkout handler signature (`razorpay_signature`) | Webhooks (`payment.captured`, `payment.failed`, `refund.processed`) with `X-Razorpay-Signature` | 4 |
| **Paddle** (Billing) | transactions, subscriptions (basic) | Webhooks with `Paddle-Signature` | 4 |
| Nagad, ShurjoPay, aamarPay, Paystack, Flutterwave, Mollie, Square, Lemon Squeezy | init + callback + IPN shapes | provider formats | later |
| **Native** | `POST /api/v1/payments` (simple JSON) and `POST /api/v1/payments/checkout` (hosted page) | native `payment.*` events | 3P |

Exact field and signature coverage per provider is verified against each provider's public docs and, where an official SDK exists, against that SDK in tests (as for SMS).

## Test cards and test wallets

Card outcomes follow **Stripe's documented test cards** for every card-based provider, so developers learn one table:

| Card number | Outcome |
|-------------|---------|
| `4242 4242 4242 4242` | succeeds (Visa) |
| `5555 5555 5555 4444` | succeeds (Mastercard) |
| `4000 0000 0000 0002` | declined: generic decline |
| `4000 0000 0000 9995` | declined: insufficient funds |
| `4000 0000 0000 0069` | declined: expired card |
| `4000 0000 0000 0127` | declined: incorrect CVC |
| `4000 0025 0000 3155` | requires 3-D Secure (challenge on the checkout page) |
| `4000 0000 0000 0259` | succeeds, then a dispute is opened (fraudulent) |

Wallet providers (bKash, Nagad) use test wallet numbers with fixed outcomes (e.g. a "success" wallet, an "insufficient balance" wallet, a "wrong PIN" wallet) and a fixed test OTP/PIN shown on the checkout page. The full tables live in Settings > Payments and the docs.

## Events

Native events (also usable in webhook rules and the realtime stream):

`payment.created`, `payment.authorized`, `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.refunded`, `payment.partially_refunded`, `payment.dispute_opened`, `payment.dispute_closed`, `checkout.completed`, `checkout.expired`, `subscription.created`, `subscription.renewed`, `subscription.payment_failed`, `subscription.canceled`.

Provider deliveries use the provider's own event names and payloads through built-in **payment templates** (Stripe event, PayPal webhook, PayPal IPN, SSLCommerz IPN, bKash callback, Razorpay webhook, Paddle webhook), see [13-webhook-templates.md](13-webhook-templates.md).

## Signing

| Provider | Scheme emulated |
|----------|-----------------|
| Stripe | `Stripe-Signature: t=<ts>,v1=<HMAC-SHA256(whsec, "t.payload")>` with the endpoint's `whsec_` secret, so `stripe.webhooks.constructEvent` works unchanged |
| PayPal | webhook headers (`PAYPAL-TRANSMISSION-ID`, `-SIG`, ...) plus a `verify-webhook-signature` endpoint on mss that returns `SUCCESS`; IPN postback returns `VERIFIED` / `INVALID` |
| SSLCommerz | `verify_sign` (MD5 over the sorted `verify_key` fields with the hashed store password) |
| Razorpay | `X-Razorpay-Signature` HMAC-SHA256 of the body with the webhook secret; checkout `razorpay_signature` over `order_id|payment_id` |
| Paddle | `Paddle-Signature: ts=..;h1=..` |
| Native | Standard Webhooks (as all native events) |

## Payment data model

- `payments`: id, provider, provider_ids (session/intent/order/charge IDs), amount_minor, currency (incl. BDT, INR, USD, EUR, ...), status (`requires_payment`, `requires_action`, `authorized`, `succeeded`, `failed`, `canceled`, `refunded`, `partially_refunded`, `disputed`), failure_code, customer (email/name/phone), method (card brand + last4 + expiry, or wallet number masked), line_items JSON, metadata JSON, success/fail/cancel URLs, notification URL, request_raw, created_at, updated_at.
- `payment_events`: timeline (created, 3DS, authorized, captured, refunded, disputed, notifications sent).
- `refunds`, `disputes`, `subscriptions` (Phase 4+).
- Merchant config per provider (store ID/password, API keys, webhook secrets) lives in the seed file as variables (`${ENV}` references for secrets).

## UI

- **Payments** screen: list (amount, currency, provider badge, status, customer, time), filters (status, provider, currency), detail with timeline, method, line items, redirects and IPN/webhook deliveries (linked to the webhook delivery log), and a **Simulate** menu (succeed, decline with reason, refund full/partial, open/resolve dispute, expire checkout, resend IPN).
- **Test checkout page** (`/pay/{sessionId}`): a clean, provider-neutral checkout styled per provider theme (Stripe-like card form, PayPal-like approve, SSLCommerz-like method picker with cards / mobile banking / net banking, bKash-like wallet + OTP + PIN steps), always with the TEST MODE banner and the outcome controls.
- **Settings > Payments**: merchant credentials per provider, default currency, automatic outcome profile (`interactive` = wait for the checkout page, `auto-success`, `auto-decline`, `random` with rate), test card and wallet tables.
- Overview: payments count, success rate, revenue (test) per currency.

## API (mss native)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payments` | create a payment (native) |
| POST | `/payments/checkout` | create a hosted checkout session (native) |
| GET | `/payments`, `/payments/{paymentId}` | list, detail with timeline |
| POST | `/payments/{paymentId}/simulate` | `succeed`, `decline` (reason), `refund` (amount), `dispute`, `resolve_dispute` (won/lost), `expire`, `capture`, `void` |
| POST | `/payments/{paymentId}/notify` | resend the IPN / webhook |
| GET | `/payments/test-cards` | the test card and wallet tables |
| GET | `/wait/payment?status=succeeded&timeout=10s` | wait helper for tests |

CLI: `mss payments list|show|simulate|notify|test-cards`. MCP toolset `payments`: `mss_payment_list`, `mss_payment_get`, `mss_payment_simulate`, `mss_payment_notify`, `mss_payment_create_checkout`, `mss_payment_wait`.

## Roadmap placement

- **Phase U2:** Payments screen, payment detail, Simulate menu, test checkout page (all provider themes) and Settings > Payments on mock data.
- **Phase 3P (new, after Phase 3):** native payments API, hosted checkout flow, Stripe, PayPal and SSLCommerz emulation, test cards, events, signing, validation APIs, payment templates, CLI and MCP `payments` toolset.
- **Phase 4:** bKash, Razorpay, Paddle; subscriptions; disputes polish.
- **Later:** Nagad, ShurjoPay, aamarPay, Paystack, Flutterwave, Mollie, Square, Lemon Squeezy.

Acceptance criteria: [acceptance/08-payments.md](acceptance/08-payments.md).
