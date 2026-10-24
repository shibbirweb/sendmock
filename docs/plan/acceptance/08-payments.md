# Acceptance: Payments (PY)

Plan: [17-payments.md](../17-payments.md). Rules for IDs, ticking and tests: [README.md](README.md).

## PY-01 Safety

Phase 3P.

- [ ] PY-01.1 A card number that passes the Luhn check but is not a documented test card is rejected with a "use a test card" error and appears in no table, log, event or response.
- [ ] PY-01.2 Stored payment methods contain only brand, last 4 and expiry; no full card number or CVC is stored anywhere.
- [ ] PY-01.3 mss never opens a network connection to a real payment provider or card network (tested by running every flow with outbound traffic blocked).
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
- [ ] PY-05.2 Webhooks are sent with PayPal transmission headers, and `verify-webhook-signature` on mss returns `SUCCESS` for genuine deliveries and `FAILURE` for altered ones.
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
- [ ] PY-09.4 Settings > Payments edits merchant credentials (secrets masked), outcome profile and shows the test card and wallet tables.

## PY-10 More gateways

Phase 4 (bKash, Razorpay, Paddle), later (others).

- [ ] PY-10.1 bKash tokenized checkout (grant token, create, execute, query, refund) and callbacks work with test wallets.
- [ ] PY-10.2 Razorpay orders, capture, refunds, `razorpay_signature` and `X-Razorpay-Signature` webhooks verify with Razorpay's SDK helpers.
- [ ] PY-10.3 Paddle transactions and `Paddle-Signature` webhooks verify with Paddle's SDK.

## PY-11 CLI, MCP and test helpers

Phase 3P.

- [ ] PY-11.1 `mss payments list|show|simulate|notify|test-cards` work with `--json`.
- [ ] PY-11.2 The MCP `payments` toolset exposes create checkout, simulate, notify, list, get and wait, with correct annotations.
- [ ] PY-11.3 `GET /api/v1/wait/payment` returns when a matching payment reaches the requested status, or `408`.
