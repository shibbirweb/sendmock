# Acceptance: Payments (PY)

Plan: [17-payments.md](../17-payments.md). Rules for IDs, ticking and tests: [README.md](README.md).

## PY-01 Safety

Phase 3P.

- [ ] PY-01.1 A card number that passes the Luhn check but is not a documented test card is rejected with a "use a test card" error and appears in no table, log, event or response.
- [ ] PY-01.2 Stored payment methods contain only brand, last 4 and expiry; no full card number or CVC is stored anywhere.
- [ ] PY-01.3 SendMock never opens a network connection to a real payment provider or card network (tested by running every flow with outbound traffic blocked).
- [ ] PY-01.4 Every hosted checkout page shows the TEST MODE banner.

## PY-02 Native payments API

Phase 3P.

- [ ] PY-02.1 `POST /api/v1/payments` with a test card returns the outcome from the test card table and stores the payment.
- [ ] PY-02.2 `POST /api/v1/payments/checkout` returns a checkout URL; completing the checkout page redirects to the success, fail or cancel URL and fires the matching native event.
- [ ] PY-02.3 Amounts are stored in minor units with an ISO currency code; BDT, INR, USD, EUR and zero-decimal currencies (JPY) are handled correctly.

## PY-03 Hosted test checkout page

UI in U2, live in Phase 3P.

- [ ] PY-03.1 Pay, Decline (each reason), Cancel, 3-D Secure (approve, fail) and Delay produce the documented outcome, redirect and notification.
- [ ] PY-03.2 The page renders the provider theme being emulated (card form, PayPal approve, SSLCommerz method picker, bKash wallet, OTP and PIN steps).
- [ ] PY-03.3 Expired or already completed sessions show a clear message and cannot be paid twice.
- [ ] PY-03.4 The page is keyboard accessible and meets the UI accessibility criteria.

## PY-04 Stripe emulation

Phase 3P.

- [ ] PY-04.1 Checkout Sessions, PaymentIntents (create, confirm, capture, cancel) and Refunds return Stripe-shaped objects and errors at the real paths on the provider port.
- [ ] PY-04.2 Every test card in the table produces Stripe's documented status and decline code.
- [ ] PY-04.3 Webhook events carry a `Stripe-Signature` that the official `stripe` SDKs (Node, PHP, Python) verify with `constructEvent`.
- [ ] PY-04.4 An app using the official Stripe SDK completes checkout, receives `checkout.session.completed` and `payment_intent.succeeded`, and handles a decline.

## PY-05 PayPal emulation

Phase 3P.

- [ ] PY-05.1 Orders v2 create, approve (checkout page) and capture, and refunds, return PayPal-shaped responses and errors.
- [ ] PY-05.2 Webhooks are sent with PayPal transmission headers, and `verify-webhook-signature` on SendMock returns `SUCCESS` for genuine deliveries and `FAILURE` for altered ones.
- [ ] PY-05.3 Classic IPN is posted as a form; the `_notify-validate` postback returns `VERIFIED` for genuine messages and `INVALID` for altered ones.

## PY-06 SSLCommerz emulation

Phase 3P.

- [ ] PY-06.1 Session init returns `GatewayPageURL` and `sessionkey`; invalid store credentials return SSLCommerz's failure response.
- [ ] PY-06.2 The IPN POST carries `tran_id`, `val_id`, `amount`, `status` (`VALID`, `FAILED`, `CANCELLED`), `verify_sign` and `verify_key`, and the signature verifies with the store password as SSLCommerz documents.
- [ ] PY-06.3 The order validation API answers for `val_id` with data consistent with the IPN; unknown or tampered `val_id` values are rejected.
- [ ] PY-06.4 Success, fail and cancel redirects POST the documented fields to the app's URLs.
- [ ] PY-06.5 The refund and transaction query APIs return SSLCommerz-shaped responses.

## PY-07 After-payment operations

Phase 3P (capture, void, refund), Phase 4 (disputes, subscriptions).

- [ ] PY-07.1 Manual capture: authorize, then capture or void, with matching events.
- [ ] PY-07.2 Full and partial refunds update the payment and fire the provider's refund event; refunding more than captured is rejected.
- [ ] PY-07.3 Disputes can be opened, answered, won and lost, each with the provider's events.
- [ ] PY-07.4 Subscriptions: create, renew on simulated clock advance, payment failure and cancel, each with events.

## PY-08 Events, templates and delivery

Phase 3P.

- [ ] PY-08.1 Every native `payment.*`, `checkout.*` and `subscription.*` event fires at the right moment and can trigger webhook rules.
- [ ] PY-08.2 Built-in payment templates (Stripe event, PayPal webhook, PayPal IPN, SSLCommerz IPN, bKash callback, Razorpay webhook, Paddle webhook) render against a real payment and match provider fixtures.
- [ ] PY-08.3 IPN and webhook deliveries appear in the webhook delivery log with retries, replay and "resend IPN" from the payment detail.

## PY-09 Payments UI

UI in U2, live in Phase 3P.

- [ ] PY-09.1 The Payments list filters by status, provider and currency and updates live.
- [ ] PY-09.2 Payment detail shows the timeline, method, line items, redirects and linked notification deliveries.
- [ ] PY-09.3 The Simulate menu performs every documented action, and the result shows immediately.
- [ ] PY-09.4 Settings > Payments edits the merchant name, default currency and automatic outcome profile (each used by the next checkout), shows the test values of the enabled methods (custom ones included) as their flows ask for them, each with the gateways offering it, and links to Gateways (merchant credentials, per gateway since PY-12.2) and Methods.
- [ ] PY-09.5 The Overview shows a Payments tile with the payment count, today's count, the success rate and test revenue per currency, linking to Payments.

## PY-10 More gateways

Phase 4 (bKash, Razorpay, Paddle), later (others).

- [ ] PY-10.1 bKash tokenized checkout (grant token, create, execute, query, refund) and callbacks work with test wallets.
- [ ] PY-10.2 Razorpay orders, capture, refunds, `razorpay_signature` and `X-Razorpay-Signature` webhooks verify with Razorpay's SDK helpers.
- [ ] PY-10.3 Paddle transactions and `Paddle-Signature` webhooks verify with Paddle's SDK.

## PY-11 CLI, MCP and test helpers

Phase 3P.

- [ ] PY-11.1 `sendmock payments list|show|simulate|notify|test-cards` work with `--json`.
- [ ] PY-11.2 The MCP `payments` toolset exposes create checkout, simulate, notify, list, get and wait, with correct annotations.
- [ ] PY-11.3 `GET /api/v1/wait/payment` returns when a matching payment reaches the requested status, or `408`.

## PY-12 Gateway, method and flow configuration

UI in U2, backend, CLI, MCP and skill in Phase 3P.

- [ ] PY-12.1 Payments > Methods lists every payment method; a method can be added from a flow (card, wallet, bank, account) and edited (name, accent, test values with outcomes, OTP and PIN); a built-in shows Modified once edited and Reset to default restores it; a custom one can be deleted while no payment uses it.
- [ ] PY-12.2 Payments > Gateways lists every gateway; a gateway can be added from a built-in or blank and edited (name, accent, methods offered in order, merchant credentials with secrets masked, notification endpoint, redirect method and fields, notification content type, event names, body and header templates); built-ins show Modified and reset to default; a custom one can be deleted while no payment uses it.
- [ ] PY-12.3 The checkout page offers the gateway's methods (one directly, several in a picker grouped by flow), each running its flow with its own test values; a custom gateway's payments, redirects and notifications follow its definition.
- [ ] PY-12.4 Redirect fields and notification templates render against a chosen payment and event in a live preview with problems shown; a save with template errors is refused.
- [ ] PY-12.5 The CLI and the MCP `payments` toolset list, create, update, preview and reset gateways, methods and flows (including adding, moving, removing and editing single flow steps) with the same validation as the UI; the skill's `add-payment-gateway` workflow takes an agent from the provider's docs to a working gateway (definition, preview, test checkout, seed export) and `add-payment-flow` composes a flow step by step.
- [ ] PY-12.6 Payments > Flows lists every flow; a flow is composed step by step (add, reorder, remove and edit one step at a time) from steps (card form, account number, voucher code, OTP, PIN, signed-in account, QR code, reference code, confirm) with their own labels, in order; the built-ins (Card, Wallet, Bank, Account, QR, Bank transfer, Voucher) are editable, show Modified and Reset to default restores them; a custom flow can be deleted while no method uses it; a method's test value fields follow its flow's steps, and the checkout page runs the steps in order.
- [ ] PY-12.7 Step labels can use the label variables (`{method}`, `{amount}`, `{currency}`, `{merchant}`, `{gateway}`, `{reference}`, `{customer_email}`); the Flows sheet lists each with what it becomes and an example, every label field can insert one, each step previews its filled labels, the checkout page fills them in, and an unknown variable is refused on save with the list of known ones.

