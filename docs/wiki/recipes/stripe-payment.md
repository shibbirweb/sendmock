---
title: Stripe payment
description: Create a Stripe Checkout Session, pay with a test card on the test checkout page, and handle Stripe's signed webhook.
---

> Works in your install from Phase 3P. Try it in the [demo](/demo/payments/gateways) today.

**The situation:** your app takes payments with Stripe Checkout. You want to run the whole flow (your page, Stripe's page, back to yours, the webhook) without a Stripe account, internet or a tunnel.

**You need:** your app's Stripe client pointing at `http://127.0.0.1:8026` (Stripe SDKs accept a base URL), and your webhook handler's URL.

## Steps

1. In **Payments > Gateways**, edit **Stripe**. On **Merchant**, set the **Notification endpoint** to an endpoint for your handler (create it in **Webhooks > Endpoints** first). Its `whsec_` secret is the one your app verifies `Stripe-Signature` with.
2. In your app, start a checkout. Stripe's answer sends the browser to SendMock's checkout page.
3. Pay with `4242 4242 4242 4242`, any future expiry and any CVC.
4. The page shows where it sends the browser (your `success_url` with `session_id`) and **Return to Acme Shop**. Follow it.
5. Your handler receives `checkout.session.completed`, signed with `Stripe-Signature`, so `stripe.webhooks.constructEvent` accepts it.

Now try the other paths: `4000 0000 0000 0002` (declined), `4000 0025 0000 3155` (3-D Secure), or **Simulate > Refund...** on the payment.

## What you should see

The payment **Succeeded** in **Payments**, its timeline with the redirect and the notification, and the notification in **Webhooks > Deliveries**.

## Try it in the demo

1. Open [Payments > Gateways](/demo/payments/gateways) and press **Edit Stripe**.
2. On the **Checkout** tab, press **Open a test checkout**.
3. Fill **Card number** `4242 4242 4242 4242`, **Expiry (MM/YY)** `12/34`, **CVC** `123`, and press the **Pay** button (it shows the amount).
4. The result says "Payment successful".

## Next

- [Payments](../payments/index.md)
- [Checkout page](../payments/checkout-page.md)
