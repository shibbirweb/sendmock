---
title: Create a gateway with AI
description: A complete worked example. One prompt, every step the agent takes, what you check, and how to keep the result.
---

> Works from Phase 3P with the MCP `payments` tools; the `add-payment-gateway` prompt and the skill's workflow arrive in Phase 4. See [AI](./index.md) to set up.

This is the [Create a payment gateway](../advanced/payment-gateway.md) walkthrough, done by an agent. The provider is Upay, a mobile wallet (account number, OTP, PIN) that SendMock does not ship.

## The prompt

> Add the Upay payment gateway to SendMock so I can test my checkout. Upay's API docs are at `<link to the docs>`. Customers pay with their Upay wallet: account number, then an OTP, then a PIN. The IPN is JSON, signed with HMAC-SHA256 of the body in the `X-Upay-Signature` header, using the merchant's API secret. Run a test checkout when done, show me the redirect and the IPN, and export the seed file.

## What the agent does

Each step is one or more MCP tool calls (or CLI commands for agents without MCP):

| Step | The agent | Tool |
| --- | --- | --- |
| 1 | checks SendMock is running | `sendmock_status` |
| 2 | reads the step catalogue and the existing flows; Wallet already matches "account number, OTP, PIN" | `sendmock_payment_step_type_list`, `sendmock_payment_flow_list` |
| 3 | creates the Upay method on the Wallet flow with test numbers, OTP and PIN | `sendmock_payment_method_create` |
| 4 | creates the Upay gateway from blank | `sendmock_payment_gateway_create` |
| 5 | fills it from the docs: methods offered, credentials (the API secret as a secret), redirect method and fields, event names, the JSON body template and the `X-Upay-Signature` header template | `sendmock_payment_gateway_update` |
| 6 | renders the redirect and IPN for success, fail and cancel, and fixes any template problems | `sendmock_payment_gateway_preview` |
| 7 | creates a test checkout and pays it with a test number | `sendmock_payment_create_checkout` |
| 8 | waits for the payment and reads its redirect and notification | `sendmock_payment_wait`, `sendmock_payment_get` |
| 9 | exports the seed file into your repository | `sendmock_seed_export` |

If a call is refused (a template error, a PIN of the wrong length), the agent reads the error and corrects it, just as you would in the UI.

## What you check

1. **Payments > Gateways** lists **Upay** as Custom, with the agent badge, offering the Upay method.
2. **Payments > Methods** lists **Upay** on the Wallet flow, offered by Upay.
3. Open the gateway: the **Redirect** and **Notification** previews show the fields and signature header from Upay's docs. Compare them with the docs yourself; this is where a wrong field name would show.
4. **Payments** has the test payment, **Succeeded**, with the redirect and IPN in its timeline; the IPN is in **Webhooks > Deliveries**.
5. Run a checkout yourself from your app.

## Fixing what is wrong

Change it in the gateway sheet (it is an ordinary custom gateway), or tell the agent: "the IPN amount should be a string with two decimals", "send `status` only on success". Ask it to run the test checkout again afterwards.

## Keeping it

The agent exported `sendmock.seed.toml`; commit it. Teammates and CI get Upay too, with the API secret as an `${ENV_VAR}` reference.

## The same for other things

- "Make a QR wallet flow" composes a flow step by step ([Create a payment flow](../advanced/payment-flow.md)).
- "Add Nagad to Stripe's checkout" edits a built-in gateway; **Reset to default** undoes it.
- More prompts: [Build it with AI](./build-with-ai.md).
