import type { DeeperEntry, DeeperPage } from "../deeper-types";

const paymentListEntries: DeeperEntry[] = [
  {
    control: "heading: Payments",
    does: "Names the screen, in the header and above the list.",
  },
  {
    control: "link: Read the Payments guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Payments](../../payments/index.md).",
  },
  {
    control:
      "paragraph: Test payments made through the emulated gateways. No real money moves, and only test cards are accepted.",
    does: "Explains the screen and its safety rule: a real card number is refused and never stored.",
    operationIds: ["getPayments"],
  },
  { control: "button: New payment", does: "Opens New payment." },
  { control: "button: All", does: "Shows every payment." },
  { control: "button: Succeeded", does: "Shows payments that succeeded." },
  {
    control: "button: Pending",
    does: "Shows payments not finished yet: open checkouts, authorized but not captured, or waiting for 3-D Secure.",
  },
  { control: "button: Failed", does: "Shows declined and failed payments." },
  {
    control: "button: Refunded",
    does: "Shows payments refunded in full or in part.",
  },
  { control: "button: Disputed", does: "Shows payments with a dispute." },
  {
    control: "combobox: Provider",
    does: "Shows one gateway's payments, or all.",
  },
  {
    control: "combobox: Currency",
    does: "Shows payments in one currency, or all.",
  },
  { control: "columnheader: Amount", does: "The amount and currency." },
  {
    control: "columnheader: Provider",
    does: "The gateway it went through, such as Stripe or SSLCommerz.",
  },
  {
    control: "columnheader: Status",
    does: "Its status, such as succeeded, requires action or refunded.",
  },
  { control: "columnheader: Customer", does: "The customer's email." },
  { control: "columnheader: Time", does: "When it was created." },
  {
    control: "each item, link: …",
    does: "Opens the payment's drawer.",
    operationIds: ["getPaymentsByPaymentId"],
  },
  {
    control: "paragraph: No payments yet",
    does: "Shown when no payment was made yet.",
  },
  {
    control:
      "paragraph: Payments appear here when your app creates one through POST /api/v#/payments, a hosted checkout (POST /api/v#/payments/checkout) or an emulated provider such as Stripe or SSLCommerz.",
    does: "Explains the three ways payments arrive.",
  },
  {
    control: "alert: Could not load the payments. Try again",
    does: "Shown when the payments could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the payments.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getPayments"],
  },
];

const paymentDialogEntries: DeeperEntry[] = [
  { control: "heading: New payment", does: "The New payment dialog." },
  {
    control:
      "paragraph: Paid at once with the test card, as your app's server does without a checkout page. The card's outcome decides it.",
    does: "Explains a direct payment: the test card decides success, decline or 3-D Secure.",
    links: "[Payments](../../payments/index.md).",
  },
  {
    control: "combobox: Gateway",
    does: "The gateway the payment goes through.",
  },
  {
    control: "combobox: Capture",
    does: "Capture at once, or only authorize and capture later.",
  },
  {
    control: "textbox: Amount",
    does: "The amount, in the currency's main unit.",
  },
  {
    control: "textbox: Currency",
    does: "The three-letter currency code, such as `USD`.",
  },
  {
    control: "textbox: Test card",
    does: "A documented test card number; its outcome decides the payment.",
    errors:
      'A real card number is refused with "use a test card" and nothing is stored.',
  },
  { control: "textbox: Customer email", does: "The customer's email." },
  {
    control: "button: Cancel",
    does: "Closes the dialog without doing anything.",
  },
  {
    control: "button: Pay",
    does: "Creates and pays the payment.",
    changes:
      "Fires `payment.created` and then `payment.succeeded` or `payment.failed`, and the gateway's notification.",
    operationIds: ["postPayments"],
  },
  { control: "button: Close", does: "Closes the dialog or drawer." },
  { control: "heading: Payment", does: "The payment drawer." },
  {
    control: "paragraph: Test payment: no real money moved.",
    does: "Reminds that nothing real happened.",
  },
  {
    control: "button: Copy checkout_session",
    does: "Copies the provider's checkout session id.",
  },
  {
    control: "button: Copy payment_intent",
    does: "Copies the provider's payment id (here a Stripe PaymentIntent).",
  },
  {
    control: "button: Simulate",
    does: "Opens what can happen next to this payment: capture, void, refund, dispute, expire and more, by its status.",
  },
  {
    control: "button: Resend notification",
    does: "Sends the gateway's notification for the payment's current status again.",
    operationIds: ["postPaymentsByPaymentIdNotify"],
  },
  { control: "heading: Line items", does: "What was bought." },
  { control: "columnheader: Item", does: "The item." },
  { control: "columnheader: Qty", does: "How many." },
  { control: "columnheader: Price", does: "The price of one." },
  { control: "columnheader: Total", does: "The line's total." },
  {
    control: "paragraph: Metadata: order_id=ord_XJD#C",
    does: "The metadata your app sent (here an order id).",
  },
  {
    control: "heading: Timeline",
    does: "Every step the payment went through, with times.",
  },
  {
    control: "heading: Redirects",
    does: "Where the customer was sent back to, with the fields of each redirect.",
  },
  {
    control: "heading: Notifications",
    does: "The notifications the gateway sent your app.",
  },
  {
    control: "each item, link: # … # minutes ago",
    does: "A notification: its status code, event and time; opens its delivery.",
    links: "[Deliveries](../../webhooks/deliveries.md).",
  },
  {
    control: "menuitem: Refund...",
    does: "Opens Refund payment.",
  },
  {
    control: "menuitem: Open dispute",
    does: "Opens a dispute on the payment, as when the customer contests it.",
    changes: "Fires `payment.dispute_opened` and the gateway's notification.",
    operationIds: ["postPaymentsByPaymentIdSimulate"],
  },
  { control: "heading: Refund payment", does: "The Refund payment dialog." },
  {
    control: "paragraph: $#.# can be refunded.",
    does: "How much is left to refund.",
  },
  {
    control: "textbox: Amount (USD)",
    does: "How much to refund; less than the whole is a partial refund.",
  },
  {
    control: "button: Refund",
    does: "Refunds the amount.",
    changes:
      "Fires `payment.refunded` or `payment.partially_refunded` and the gateway's notification.",
    operationIds: ["postPaymentsByPaymentIdSimulate"],
  },
  { control: "heading: Answer dispute", does: "The Answer dispute dialog." },
  {
    control:
      "paragraph: The dispute goes under review until it is won or lost.",
    does: "Explains what answering does.",
  },
  {
    control: "textbox: Evidence",
    does: "What you send the card network as evidence.",
  },
  {
    control: "button: Send answer",
    does: "Answers the dispute; it goes under review.",
    changes: "Fires `payment.dispute_updated`.",
    operationIds: ["postPaymentsByPaymentIdSimulate"],
  },
];

/** Payments > All payments: test payments, a payment's drawer and its dialogs. */
export const paymentsListPage: DeeperPage = {
  screen: "/payments",
  file: "payments/all-payments.md",
  title: "Payments in depth",
  description:
    "Every control and text of Payments > All payments, a payment and its dialogs.",
  guidePage: "payments/index.md",
  guideTitle: "Payments",
  intro:
    "Payments > All payments lists every test payment, from any gateway, and lets you simulate what happens next.",
  entries: [...paymentListEntries, ...paymentDialogEntries],
};
