---
title: Create a payment flow
description: Compose the steps a checkout asks for from the step catalogue, label them, and use the flow in a method.
---

> Works in your install from Phase 3P. Try it in the [demo](/demo/payments/flows) today.

A flow is the order of steps on the checkout page. Build one when your provider's checkout differs from the built-ins: a QR code to scan, a PIN before the OTP, a voucher then a confirm.

## When you would

- Your provider shows a QR code and waits ("Upay QR").
- Your wallet asks for the PIN first, then the code.
- You want the labels to say exactly what your provider's page says.

## Steps: a QR wallet flow

1. Open **Payments > Flows** and press **Add flow**.
2. **Name** `Upay QR`, **Key** `upay_qr` (suggested), **Picker tab** `Scan to pay` (the checkout groups the method under this tab). Press **Add flow**.
3. The new flow starts with one Confirm step. Press **Add step** > **QR code**, then **Remove Step 1: Confirm**.
4. Edit the QR step's labels: **Title**, **Field label**, **Hint** and **Button text**, for example button text `Paid in the app`. Use **Insert variable** to add `{method}`, `{amount}`, `{merchant}` and the others; the preview under the step shows them filled in.
5. Press **Save flow**. The row shows "QR code" and **Custom**.
6. Use it: in **Payments > Methods**, **Add method**, pick **Upay QR** under **Flow**, name it, and save. Then offer the method on a gateway.

## Rules a flow follows

- 1 to 6 steps, each from the catalogue: Card form, Account number, Voucher code, OTP, PIN, Signed-in account, QR code, Reference code, Confirm.
- At most one **deciding** step (Card form, Account number, Voucher code). The **Add step** menu greys out a second one ("The flow already has a deciding step"). Without one, the method's outcome decides.
- Label variables: `{method}`, `{amount}`, `{currency}`, `{merchant}`, `{gateway}`, `{reference}`, `{customer_email}`. An unknown one (`{ammount}`) is refused on save, naming the ones that exist.

## Change a built-in instead

Edit **Wallet**, **Card**, **Bank** and the others the same way: reorder (**Move Step 3: PIN up**), relabel, add or remove steps. Every method using the flow changes at once; the row shows **Modified** and **Reset to default** restores it.

## Undo

A custom flow can be deleted while no method uses it ("1 methods use Upay QR; delete those methods first").

## Limits

A step SendMock cannot show yet needs code: a checkout component and a server check. Ask for it with a provider request issue.

## With the API, CLI and AI

```bash
sendmock payments flows step-types           # the catalogue
sendmock payments flows variables            # the label variables
sendmock payments flows create --data '{"name": "Upay QR", "key": "upay_qr", "picker_tab": "Scan to pay", "steps": [{"type": "qr_code", "title": "Scan to pay", "field_label": "", "hint": "Open {method} and scan the code.", "button_label": "Paid in the app"}]}'
sendmock payments flows steps add upay_qr --data '{"step": {"type": "confirm", "title": "Confirm", "field_label": "", "hint": "", "button_label": "Confirm {amount}"}}'
sendmock payments flows steps remove upay_qr 1
```

Step types are `card_form`, `account_number`, `voucher_code`, `otp`, `pin`, `signed_in_account`, `qr_code`, `reference_code` and `confirm`.

MCP: `sendmock_payment_flow_create` and `sendmock_payment_flow_step_add`, `_move`, `_remove`, `_update`. Or ask an agent: "Make a QR wallet flow for Upay." See [Build it with AI](../ai/build-with-ai.md).

## Related

- [Flows](../payments/flows.md)
- [Create a payment method](./payment-method.md)
