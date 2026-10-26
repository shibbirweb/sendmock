---
title: Create a payment gateway
description: Emulate a payment provider SendMock does not ship, from its docs to a working checkout, redirect and notification, step by step.
---

> Works in your install from Phase 3P. Try every step in the [demo](/demo/payments/gateways) today.

SendMock ships Stripe, PayPal, SSLCommerz, bKash and a native gateway. Any other provider can be added without code, because a gateway is a definition: the methods its checkout offers, the fields its redirect sends back, and the shape and signature of its notification.

This walkthrough adds **Upay**, a mobile wallet that asks for an account number, a one-time code and a PIN. It needs a new method and a new gateway, so every part is covered. Swap in your provider's names and fields as you go.

> The field names below (`payment_ref_id`, `status`, `X-Upay-Signature`, ...) are examples. Use the ones in your provider's API docs.

## Before you start: read the provider's docs for

1. **The checkout steps** the customer goes through (here: wallet number, OTP, PIN).
2. **The redirect:** GET or POST, and the fields it adds to your success, fail and cancel URLs.
3. **The notification** (IPN or webhook): JSON or form, the event or status names, the body fields, and how it is signed.
4. **The credentials** your app sends (merchant id, API key, secret).

## 1. Pick or build the flow

Open **Payments > Flows**. The built-in **Wallet** flow is "Account number, OTP, PIN", which is Upay's checkout, so nothing to do. If your provider's steps differ (a PIN before the OTP, a QR code), build a flow first: [Create a payment flow](./payment-flow.md).

## 2. Add the method

1. Open **Payments > Methods** and press **Add method**.
2. Under **Flow**, pick **Wallet**. Set **Name** to `Upay`; the **Key** becomes `upay`. Press **Add method**.
3. The sheet opens with test values for the Wallet flow: test numbers `01600000001` (succeeds), `01600000002` (declined: insufficient balance) and `01600000003` (wrong PIN), **Test OTP** `123456` and **Test PIN** `12121`. Change them to match your tests if you like, pick an accent colour, and press **Save method**.

The method now shows "No gateway yet". More on methods: [Create a payment method](./payment-method.md).

## 3. Add the gateway

1. Open **Payments > Gateways** and press **Add gateway**.
2. Set **Name** to `Upay`; the **Key** becomes `upay`. Leave **Start from** blank (or pick the built-in gateway closest to your provider, to copy its redirect and notification), and press **Add gateway**. The gateway sheet opens.
3. **General:** pick the accent colour the checkout page uses.
4. **Checkout:** remove the methods you do not want (**Remove Card**), then **Add a method** > **Upay**. With several methods, order them as the provider's page does.
5. **Merchant:** add the credentials your app sends, one row each (`merchant_id`, `api_key`, and `api_secret` marked secret), and pick the **Notification endpoint**: the [webhook endpoint](../webhooks/endpoints.md) for your app's notification URL.
6. **Redirect:** pick GET or POST, then add a row per field: name `payment_ref_id`, template `{{ payment.reference }}`; name `status`, template `{{ redirect.status }}`. Mark fields that only come on success as **Only on success**.
7. **Notification:** pick JSON or Form; set the **event name** for each native event your provider reports (for example `payment.succeeded` as `COMPLETED`, `payment.failed` as `FAILED`; leave the rest blank to send nothing); write the **body template**; and add a header template for the signature, for example `X-Upay-Signature` as `{{ body | hmac_sha256(merchant.api_secret) }}` (`body` holds the rendered body, so the signature covers exactly what is sent). The demo's preview only knows a few filters and refuses `hmac_sha256`, so leave the signature header out when you try this in the demo; your install has every filter from Phase 3P.

A JSON body template for this example:

```json
{
  "payment_ref_id": "{{ payment.reference }}",
  "status": "{{ event.name }}",
  "amount": "{{ payment.amount_major }}",
  "currency": "{{ payment.currency }}",
  "merchant_id": "{{ merchant.merchant_id }}",
  "timestamp": {{ event.created }}
}
```

## 4. Preview

Beside **Redirect** and **Notification**, the **Preview** renders them against a payment. Change **Preview event** and **Preview redirect outcome** to see each case; "Nothing is sent for payment.created: it has no event name" means that event is blank on purpose. Problems show under each part, and **Save gateway** stays off until template errors are fixed. Press **Save gateway**.

## 5. Try a checkout

Open the gateway again, go to **Checkout** and press **Open a test checkout**. The page says "Upay test checkout" in the gateway's colour:

1. **Your Upay account number:** `01600000001`, **Confirm**.
2. **Verification code:** `123456`, **Confirm**.
3. **PIN:** `12121`, **Confirm and pay**.

The result says "Payment successful" and lists the redirect with your `payment_ref_id` field. In **Payments**, the payment is **Succeeded** with the notification in its timeline, and the request is in **Webhooks > Deliveries**.

## 6. Point your app at it

Your app's Upay client calls `http://127.0.0.1:8026/providers/upay/...` with the credentials you set. Session creation answers with the checkout URL, and the validation call answers from the payment. Send the customer to that URL, as you would to Upay.

## 7. Keep it

In **Settings > Seed**, press **Export sendmock.seed.toml** and commit the file. Teammates and CI get the same gateway and method; secret credentials are written as `${ENV_VAR}` references.

## Change a built-in instead

Every built-in gateway is editable the same way: another event name, an extra redirect field, a method your merchant account does not offer. It shows **Modified**, and **Reset to default** brings back the shipped version.

## Undo

A custom gateway can be deleted while no payment uses it; otherwise switch it off. The same goes for methods and flows.

## Limits

- A checkout step SendMock cannot show yet (a new step type) needs code.
- Provider API calls beyond creating a session and validating a payment need code.

Ask for either with a provider request issue.

## With the API, CLI and AI

The same definition works without the UI (key and flow are fixed after creation):

```bash
sendmock payments methods create --data '{"key": "upay", "name": "Upay", "flow": "wallet", "accent": "#7c3aed", "is_enabled": true, "test_cards": [], "test_numbers": [{"number": "01600000001", "outcome": "succeed", "decline_reason": null}], "otp": "123456", "pin": "12121", "default_outcome": "succeed", "test_account": ""}'
sendmock payments gateways create --data '{"name": "Upay", "key": "upay", "start_from": null}'
sendmock payments gateways update upay --file upay-gateway.json
sendmock payments gateways preview upay
```

Or ask an agent: [Create a gateway with AI](../ai/payment-gateway-with-ai.md).

## Related

- [Gateways](../payments/gateways.md)
- [Create a payment method](./payment-method.md)
- [Create a payment flow](./payment-flow.md)
