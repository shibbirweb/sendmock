---
title: Create a payment method
description: Add a wallet, bank or card method with its own test values, and offer it on any gateway.
---

> Works in your install from Phase 3P. Try it in the [demo](/demo/payments/methods) today.

A method is what a customer picks on the checkout page. Add one when your provider offers a wallet or bank SendMock does not ship (Upay, a local bank), or when you want a second card method with other test cards.

## When you would

- Your gateway offers a wallet that is not in the list.
- Your tests need test numbers, an OTP or a PIN of their own.
- You want a method that always succeeds (or always declines) for an automated test.

## Steps

1. Check the flow: the method's checkout steps come from a [flow](../payments/flows.md). A wallet uses **Wallet** (account number, OTP, PIN); a bank that only confirms uses **Bank**; a QR wallet needs a QR flow ([Create a payment flow](./payment-flow.md)).
2. Open **Payments > Methods** and press **Add method**.
3. Under **Flow**, pick the flow. Enter a **Name**; the **Key** is suggested from it (`upay`). Press **Add method**.
4. The sheet shows only the test values the flow needs, prefilled. For a wallet: three test numbers (succeeds, declined: insufficient balance, wrong PIN), **Test OTP** `123456`, **Test PIN** `12121`. Change them, add rows with **Add test number**, or remove rows.
5. Pick the accent colour and press **Save method**. Mistakes show under the field (for example "Use 4 to 6 digits" for a PIN).
6. Offer it: on a gateway's **Checkout** tab, **Add a method** > your method ([Gateways](../payments/gateways.md)).

The method's row now says which gateways offer it, and **Settings > Payments** lists its test values.

## Test values by flow

| Flow has | You set |
| --- | --- |
| a card form | test cards, each with an outcome; only numbers from the documented test ranges that pass the Luhn check |
| an account number or voucher step | test numbers or codes, each with an outcome |
| an OTP step | the test OTP |
| a PIN step | the test PIN (4 to 6 digits) |
| a signed-in account step | the test account (an email) |
| no deciding step | the outcome: succeeds or declined |

## Change a built-in instead

Edit Card, PayPal account, bKash, Nagad, Rocket, DBBL Nexus, City Touch or BRAC iBanking the same way. Changes reach every checkout at once; the row shows **Modified** and **Reset to default** restores it. A switch in the table turns a method off everywhere.

## Undo

A custom method can be deleted (**Delete** in its sheet) while no payment uses it.

## With the API, CLI and AI

```bash
sendmock payments methods create --data '{"key": "upay", "name": "Upay", "flow": "wallet", "accent": "#7c3aed", "is_enabled": true, "test_cards": [], "test_numbers": [{"number": "01600000001", "outcome": "succeed", "decline_reason": null}], "otp": "123456", "pin": "12121", "default_outcome": "succeed", "test_account": ""}'
sendmock payments methods reset bkash
```

MCP: `sendmock_payment_method_create`, `_update`, `_reset`. Or ask an agent: "Add Upay as a wallet method with test number 01600000001."

## Related

- [Methods](../payments/methods.md)
- [Create a payment gateway](./payment-gateway.md)
