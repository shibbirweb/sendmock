# 17. Payment Gateway Emulation

SendMock also acts as a **fake payment gateway**. Apps create payments or checkout sessions against provider-compatible APIs (Stripe, PayPal, SSLCommerz, bKash, Razorpay, ...), the user "pays" on a SendMock-hosted test checkout page (or the API confirms with a test card), and SendMock sends the gateway's callbacks: redirects to the app's success/fail/cancel URLs plus **IPN / webhook events**, signed like the real provider. Refunds, captures, disputes and subscriptions can be simulated too.

This lets developers build and test the whole payment flow, including IPN handlers, signature checks, order validation and failure paths, locally and offline, with no sandbox account and no internet.

## Why

- Real sandboxes need accounts, keys, internet and a public URL (tunnel) for IPN; they are slow to reset and hard to drive into edge cases.
- Regional gateways (SSLCommerz, bKash, Nagad, Razorpay) have limited or flaky sandboxes, and their IPN/validation steps are where most integration bugs are.
- Payment events fit the existing webhook engine: the same rules, templates, variables, signing, retries, replay and delivery log apply.

## Safety rules (non-negotiable)

- **No real money, ever.** SendMock never contacts a real gateway or card network.
- **Only test card numbers are accepted.** Any card number that passes the Luhn check but is not a documented test card is rejected with "Use a test card" and is **never stored or logged** (not even masked). This protects developers who paste a real card by mistake.
- Stored payment methods are reduced to brand, last 4 and expiry; no full PAN or CVC is ever kept.
- Hosted checkout pages show a permanent "TEST MODE: no real payment" banner.

## Flows

### 1. Hosted checkout (redirect flow)

1. The app creates a session (e.g. Stripe `POST /v1/checkout/sessions`, PayPal `POST /v2/checkout/orders`, SSLCommerz `POST /gwprocess/v4/api.php`, bKash create payment).
2. SendMock returns the provider-shaped response with a redirect URL to the **SendMock test checkout page** (`http://127.0.0.1:8025/pay/{sessionId}`).
3. The checkout page shows the order (amount, currency, items, merchant) and test controls: **Pay successfully**, **Decline** (choose a reason: insufficient funds, expired card, incorrect CVC, generic decline, fraud), **Cancel**, **Require 3-D Secure** (then approve or fail the challenge), and **Delay** (stay pending, settle later). Card, wallet (bKash/Nagad style PIN/OTP screens) or bank options follow the provider being emulated.
4. SendMock redirects the browser to the app's `success_url` / `fail_url` / `cancel_url` with the provider's parameters (GET or POST, as the provider does).
5. SendMock fires the provider's **server-to-server notification** (IPN / webhook) to the app, signed, through the webhook engine (retries, delivery log, replay).
6. The app can call the provider's **validation / retrieve API** on SendMock (e.g. SSLCommerz order validation with `val_id`, PayPal IPN postback `cmd=_notify-validate`, Stripe `GET /v1/checkout/sessions/{id}`), which answers consistently with what happened.

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

Wallet providers (bKash, Nagad) use test wallet numbers with fixed outcomes and a fixed test OTP and PIN shown on the checkout page:

| Wallet number | Outcome |
|---------------|---------|
| `01770000001` | succeeds |
| `01770000002` | declined: insufficient balance |
| `01770000003` | wrong PIN (asked again) |

The test OTP is `123456` and the test PIN is `12121`. A number that is not a test wallet is refused with "Use a test wallet". The full tables live in Settings > Payments and the docs.

## Gateways and payment methods (configurable)

Gateways and payment methods are data, not code, so a developer can emulate a gateway SendMock does not ship, change how a built-in one behaves, and go back to the shipped behaviour at any time.

- **Payment flow:** the steps a customer goes through on the checkout page, in order, built from a fixed catalogue of step types that SendMock knows how to show and check:

  | Step | Shows | Checked against the method's |
  |------|-------|------------------------------|
  | Card form | number, expiry, CVC, name (and a 3-D Secure challenge when the test card asks for one) | test cards and their outcomes |
  | Account number | a number field (wallet, phone or account) | test numbers and their outcomes |
  | Voucher code | a code field | test numbers and their outcomes |
  | OTP | a verification code field | test OTP |
  | PIN | a PIN field (asked again when wrong) | test PIN |
  | Signed-in account | the test account with Approve and Cancel | test account |
  | QR code | a QR code to scan with "I have paid" | default outcome |
  | Reference code | a reference to pay with elsewhere and "I have paid" | default outcome |
  | Confirm | a confirm button | default outcome |

  - A flow is composed step by step: add a step from the catalogue, move it up or down, remove it, and edit its labels, one change at a time, by hand in Payments > Flows or by an AI agent through the CLI, the MCP `payments` toolset and the skill (same operations, same validation).
  - Each step has its own title, field label, hint and button text. Labels can use these variables, filled in on the checkout page:

    | Variable | Becomes | Example |
    |----------|---------|---------|
    | `{method}` | the payment method's name | bKash |
    | `{amount}` | the amount to pay, in the currency's format | BDT 1,200.00 |
    | `{currency}` | the currency code | BDT |
    | `{merchant}` | the merchant name shown on checkout pages | Acme Shop |
    | `{gateway}` | the gateway's name | SSLCommerz |
    | `{reference}` | the payment reference the customer quotes (as the reference code step shows it) | SM-8F2KD9XL |
    | `{customer_email}` | the customer's email, or empty | ruma@example.com |

    An unknown variable (`{methd}`) is refused when the flow is saved, naming the ones that exist. The list is served by `GET /payments/flow-variables`, so the CLI, MCP tools and skill use the same names.
  - A flow has a name, a key, the picker tab it belongs to (e.g. "Mobile banking") and 1 to 6 steps, with at most one deciding step (card form, account number or voucher code); without one, the method's default outcome decides.
  - Built-in flows ship ready to use:

    | Flow | Steps | Picker tab |
    |------|-------|------------|
    | Card | card form | Cards |
    | Wallet | account number, OTP, PIN | Mobile banking |
    | Bank | confirm | Net banking |
    | Account | signed-in account | Accounts |
    | QR | QR code | Scan to pay |
    | Bank transfer | reference code | Bank transfer |
    | Voucher | voucher code | Vouchers |

  - Built-ins are editable (labels, order, steps added or removed), show **Modified** once changed and **Reset to default** restores the shipped steps and labels (asks first). They cannot be deleted. Custom flows are composed from the same step catalogue and can be deleted while no method uses them.
  - A new step type (one SendMock cannot show yet) still needs code: a checkout component and a server check, one entry in each registry.
- **Payment method:** what the customer pays with on a checkout page: a name, a key, an accent colour, its flow, and the test values the flow's steps need (test cards, test numbers with outcomes, OTP, PIN, test account, default outcome). Built-ins: Card, PayPal account, bKash, Nagad, Rocket, DBBL Nexus, City Touch, BRAC iBanking.
- **Gateway:** an emulated provider.
  - Name, key (the `provider` value in the API and in `/providers/<key>/...` paths), accent colour, enabled.
  - **Methods offered**, in order: the checkout page shows one method directly, or a picker grouped by each flow's picker tab (Cards, Mobile banking, Net banking, ...) when there are several.
  - **Merchant credentials** as name / value rows (store id, secret key, ...), each marked secret or not; secrets are masked everywhere (the API returns `••••` and the last 4, a masked value sent back keeps the stored one, the plain value is fetched only by an explicit reveal) and written to seed exports as `${ENV}` references.
  - **Notification endpoint** (a webhook endpoint) for its IPN or webhook deliveries.
  - **Redirect:** GET or POST, and the fields sent back to the app as name / template rows; each row is sent always or only on success (PayPal's `PayerID`).
  - **Notification:** content type (JSON or form), the gateway's event name for each native event (none means it sends nothing for that event), a body template and header templates (for signatures).
  - Templates read `payment` (id, reference, amount_minor and amount_major, currency, status, failure code, customer, method, provider ids, metadata), `event` (id, native `type`, the gateway's `name` for it, `created` as Unix seconds), `redirect` (`outcome` success / fail / cancel and `status`, the gateway's event name for the outcome), `merchant` (the credentials by name) and the usual functions and filters, plus `uuid()`, `random_hex(length)`, `now_iso()` and `stripe_signature(secret)` for signature-shaped headers. A form notification's body template is the encoded form (`tran_id={{ payment.reference | urlencode }}&...`).
  - A live preview renders them against a chosen payment, event and redirect outcome, with secrets masked and problems under each part; a save with template errors is refused.
  - The built-in gateways are these definitions too: their redirect fields, event names, bodies and signature headers reproduce the shapes in [Provider emulation](#provider-emulation).
- **Built-ins** (Stripe, PayPal, SSLCommerz, bKash, Native, and the built-in methods) are editable. An edited built-in shows **Modified** and **Reset to default** restores the shipped version. Built-ins cannot be deleted; they can be disabled.
- **Custom gateways** start from a built-in (its methods, redirect and notification shapes are copied, then edited) or from blank. Custom methods start from a flow. Both can be deleted when no payment uses them (otherwise disabled).
- **AI-assisted:** gateways and methods are operations in the registry like everything else, so the CLI (`sendmock payments gateways|methods ...`) and the MCP `payments` toolset can list, create, update, preview and reset them, and compose flows step by step (`sendmock payments flows steps add|move|remove|update`), with the same validation as the UI. The agent skill's `add-payment-gateway` workflow (and the MCP prompt of the same name) lets a developer say "add the Nagad gateway" or "add Upay as a wallet", and `add-payment-flow` handles "make a QR wallet flow": the agent reads the provider's docs, writes the definition, checks the preview, runs a test checkout and exports the result to the seed file. See [14-ai-integration.md](14-ai-integration.md#prompts).
- Changes apply to new checkouts, redirects and notifications at once. The provider wire APIs (session init, validation) of custom gateways are emulated in Phase 3P from the same definition: init returns the checkout URL, and validation answers from the payment.

## Events

Native events (also usable in webhook rules and the realtime stream):

`payment.created`, `payment.authorized`, `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.refunded`, `payment.partially_refunded`, `payment.dispute_opened`, `payment.dispute_closed`, `checkout.completed`, `checkout.expired`, `subscription.created`, `subscription.renewed`, `subscription.payment_failed`, `subscription.canceled`.

Provider deliveries use the provider's own event names and payloads through built-in **payment templates** (Stripe event, PayPal webhook, PayPal IPN, SSLCommerz IPN, bKash callback, Razorpay webhook, Paddle webhook), see [13-webhook-templates.md](13-webhook-templates.md).

## Signing

| Provider | Scheme emulated |
|----------|-----------------|
| Stripe | `Stripe-Signature: t=<ts>,v1=<HMAC-SHA256(whsec, "t.payload")>` with the endpoint's `whsec_` secret, so `stripe.webhooks.constructEvent` works unchanged |
| PayPal | webhook headers (`PAYPAL-TRANSMISSION-ID`, `-SIG`, ...) plus a `verify-webhook-signature` endpoint on SendMock that returns `SUCCESS`; IPN postback returns `VERIFIED` / `INVALID` |
| SSLCommerz | `verify_sign` (MD5 over the sorted `verify_key` fields with the hashed store password) |
| Razorpay | `X-Razorpay-Signature` HMAC-SHA256 of the body with the webhook secret; checkout `razorpay_signature` over `order_id|payment_id` |
| Paddle | `Paddle-Signature: ts=..;h1=..` |
| Native | Standard Webhooks (as all native events) |

## Payment data model

- `payment_gateways`, `payment_methods` and `payment_flows`: the definitions above, with `is_builtin`, `is_modified` and the shipped default kept for reset.
- `payments`: id, provider, provider_ids (session/intent/order/charge IDs), amount_minor, currency (incl. BDT, INR, USD, EUR, ...), status (`requires_payment`, `requires_action`, `authorized`, `succeeded`, `failed`, `canceled`, `refunded`, `partially_refunded`, `disputed`), failure_code, customer (email/name/phone), method (card brand + last4 + expiry, or wallet number masked), line_items JSON, metadata JSON, success/fail/cancel URLs, notification URL, request_raw, created_at, updated_at.
- `payment_events`: timeline (created, 3DS, authorized, captured, refunded, disputed, notifications sent).
- `refunds`, `disputes`, `subscriptions` (Phase 4+).
- Merchant config per provider (store ID/password, API keys, webhook secrets) lives in the seed file as variables (`${ENV}` references for secrets).

## UI

- **Payments** screen: list (amount, currency, provider badge, status, customer, time), filters (status, provider, currency), detail with timeline, method, line items, redirects and IPN/webhook deliveries (linked to the webhook delivery log), and a **Simulate** menu (succeed, decline with reason, refund full/partial, open/resolve dispute, expire checkout, resend IPN).
- **Test checkout page** (`/pay/{sessionId}`): a clean, provider-neutral checkout styled per provider theme (Stripe-like card form, PayPal-like approve, SSLCommerz-like method picker with cards / mobile banking / net banking, bKash-like wallet + OTP + PIN steps), always with the TEST MODE banner and the outcome controls.
- **Gateways** (Payments > Gateways), **Methods** (Payments > Methods) and **Flows** (Payments > Flows) screens: see [Gateways and payment methods](#gateways-and-payment-methods-configurable). The notification endpoint and merchant credentials are set per gateway; IPN and webhook notifications are deliveries to that endpoint, so they share the delivery log, retries and replay.
- **Settings > Payments**:
  - Merchant name: shown on checkout pages and in the `{merchant}` label variable.
  - Default currency: used by `POST /payments/checkout` when the request sets none (and by Open a test checkout).
  - Automatic outcome profile for new hosted checkouts: `interactive` (wait for the checkout page), `auto_success` and `auto_decline` (settle at once, a decline with `generic_decline`), `random` (succeeds at the chosen rate, else declines). The checkout page of a settled checkout shows its result.
  - The test values of the enabled methods, read through each method's flow so only what its checkout asks for is shown, custom methods included: test cards (methods whose flow has a card form), test numbers or voucher codes with the OTP and PIN when the flow has those steps, and the other methods with what happens (the signed-in test account, or always succeeds / declines). Every row names the gateways offering the method ("No gateway yet" when none), so a new gateway shows next to its methods. Links to Payments > Gateways (where merchant credentials now live, per gateway) and Payments > Methods.
  - Settings keys: `payment_merchant_name`, `payment_default_currency`, `payment_outcome_profile`, `payment_random_success_rate_percent`.
- **Overview:** a Payments stat tile with the payment count and today's count, the success rate (succeeded among finished payments) and test revenue per currency (captured minus refunded), linking to Payments.

## API (SendMock native)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payments` | create a payment (native) |
| POST | `/payments/checkout` | create a hosted checkout session (native); `provider` picks the gateway, so the Gateways screen opens a test checkout of any gateway, custom ones included |
| GET | `/payments`, `/payments/{paymentId}` | list (newest first, paged; `status`, `provider`, `currency` filters), detail with timeline, redirects and linked notification deliveries |
| POST | `/payments/{paymentId}/simulate` | `succeed`, `decline` (reason), `refund` (amount), `dispute`, `resolve_dispute` (won/lost), `expire`, `capture`, `void`; an action the status does not allow, or a refund above what is left, returns `409` / `422` |
| POST | `/payments/{paymentId}/notify` | resend the IPN / webhook |
| GET | `/payments/test-cards` | the test card and wallet tables |
| GET/POST/PATCH/DELETE | `/payments/gateways` | gateways; `POST` takes `{ "name", "key", "start_from" }`; built-ins cannot be deleted |
| POST | `/payments/gateways/{gatewayKey}/reset` | restore a built-in gateway |
| POST | `/payments/gateways/{gatewayKey}/preview` | render an unsaved gateway's redirect fields and notification for an event against a payment, with template problems and the template reference for `{{` suggestions |
| GET | `/payments/gateways/{gatewayKey}/credentials/{credentialName}` | reveal one secret credential (the UI asks first) |
| GET/POST/PATCH/DELETE | `/payments/methods` | payment methods; built-ins cannot be deleted |
| POST | `/payments/methods/{methodKey}/reset` | restore a built-in method |
| GET/POST/PATCH/DELETE | `/payments/flows` | payment flows (steps in order with their labels); built-ins cannot be deleted, custom ones only while no method uses them |
| POST | `/payments/flows/{flowKey}/reset` | restore a built-in flow |
| POST/PATCH/DELETE | `/payments/flows/{flowKey}/steps[/{stepIndex}]` | add a step, update its labels or position, remove it (one step at a time) |
| GET | `/payments/step-types` | the step catalogue with each step's fields and which method test values it reads |
| GET | `/payments/flow-variables` | the variables step labels can use, with what each becomes and an example |
| GET | `/checkout-sessions/{sessionId}` | what the test checkout page shows: merchant, order, provider theme and the session state (open, needs 3-D Secure, pending, completed, failed, canceled, expired) with the redirect once finished |
| POST | `/checkout-sessions/{sessionId}/complete` | the page's actions: `pay` (with a test card or test wallet, OTP and PIN), `decline` (reason), `cancel`, `delay`, `require_three_ds`, `three_ds_approve`, `three_ds_fail`; `422` "Use a test card" for a real card number (never stored), `409` for a closed session |
| GET | `/wait/payment?status=succeeded&timeout=10s` | wait helper for tests |

CLI and MCP: every payment operation has a command and a tool, listed in [14-ai-integration.md](14-ai-integration.md#command-tree) from the [surface catalogue](20-surface-parity.md); for example `sendmock payments simulate` and `sendmock_payment_simulate`, and `sendmock payments checkout complete` and `sendmock_checkout_complete` to finish a test checkout from a script or an agent.

## Roadmap placement

- **Phase U2:** Payments screen, payment detail, Simulate menu, test checkout page (all provider themes), Gateways and Methods screens (add, edit, reset) and Settings > Payments on mock data.
- **Phase 3P (new, after Phase 3):** native payments API, hosted checkout flow, Stripe, PayPal and SSLCommerz emulation, test cards, events, signing, validation APIs, payment templates, CLI and MCP `payments` toolset.
- **Phase 4:** bKash, Razorpay, Paddle; subscriptions; disputes polish.
- **Later:** Nagad, ShurjoPay, aamarPay, Paystack, Flutterwave, Mollie, Square, Lemon Squeezy.

Acceptance criteria: [acceptance/08-payments.md](acceptance/08-payments.md).
