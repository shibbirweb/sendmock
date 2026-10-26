---
title: SSLCommerz and bKash
description: Pay through SSLCommerz with a test bKash wallet, get the POST redirect and the signed IPN, and validate the payment.
---

> Works in your install from Phase 3P (SSLCommerz) and Phase 4 (bKash's own API). Try it in the [demo](/demo/payments/gateways) today.

**The situation:** your app sells in Bangladesh through SSLCommerz. Customers pay with cards, mobile wallets (bKash, Nagad, Rocket) or internet banking. You need to test the success, fail and cancel redirects, the IPN with its `verify_sign`, and the order validation call.

**You need:** your app's SSLCommerz client pointing at `http://127.0.0.1:8026`, and its IPN handler URL.

## Steps

1. In **Payments > Gateways**, edit **SSLCommerz**. On **Merchant**, set `store_id` and `store_passwd` to what your app sends, and the **Notification endpoint** to an endpoint for your IPN URL.
2. In your app, start a payment. The session answer sends the browser to SendMock's checkout page, with tabs: Cards, Mobile banking, Net banking.
3. Open **Mobile banking** and pick **bKash**. Enter `01770000001` and press **Confirm**, the code `123456` and **Confirm**, the PIN `12121` and **Confirm and pay**.
4. SendMock sends the browser back to your `success_url` **by POST** with SSLCommerz's fields (`status=VALID`, `tran_id`, `val_id`, ...), and posts the IPN.
5. Your app calls the order validation API with `val_id`; SendMock answers from the payment.

Try `01770000002` (insufficient balance) for the fail path, and **Cancel payment** in the test controls for the cancel path.

## What you should see

The payment in **Payments** with its redirect (POST, with the fields) and IPN in the timeline, and the IPN in **Webhooks > Deliveries**.

## Try it in the demo

1. Open [Payments > Gateways](/demo/payments/gateways), press **Edit SSLCommerz**, and on **Checkout** press **Open a test checkout**.
2. Open the **Mobile banking** tab and pick **bKash**.
3. Enter `01770000001`, **Confirm**; `123456`, **Confirm**; `12121`, **Confirm and pay**.
4. The result says the browser returns by POST, with `VALID` among the fields.

## Next

- [Checkout page](../payments/checkout-page.md)
- [Methods](../payments/methods.md)
