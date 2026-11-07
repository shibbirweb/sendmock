import type { DeeperEntry, DeeperPage } from "../deeper-types";

const flowChoices: [string, string][] = [
  ["Card Card form", "A card form."],
  [
    "Wallet Account number, OTP, PIN",
    "A mobile wallet: account number, then a one-time code, then a PIN.",
  ],
  ["Bank Confirm", "A bank confirmation page."],
  ["Account Signed-in account", "A signed-in account, as PayPal's."],
  ["QR QR code", "A QR code to scan."],
  ["Bank transfer Reference code", "A bank transfer with a reference code."],
  ["Voucher Voucher code", "A voucher code."],
];

export const methodEntries: DeeperEntry[] = [
  { control: "heading: Methods", does: "Names the open screen in the header." },
  {
    control: "link: Read the Methods guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Methods](../../payments/methods.md).",
  },
  {
    control: "heading: Payment methods",
    does: "What customers pay with.",
    operationIds: ["getPaymentsMethods"],
  },
  {
    control:
      "paragraph: What customers pay with on test checkout pages, and the test values each one accepts.",
    does: "Explains the screen.",
  },
  {
    control: "button: Add method",
    does: "Opens Add a payment method; in it, adds the method.",
    operationIds: ["postPaymentsMethods"],
  },
  { control: "columnheader: Method", does: "The method's name." },
  {
    control: "columnheader: Flow",
    does: "The flow the customer goes through.",
  },
  { control: "columnheader: Offered by", does: "The gateways that offer it." },
  {
    control: "columnheader: Test values",
    does: "The test values it accepts, with the outcome of each.",
  },
  {
    control: "columnheader: Enabled",
    does: "Whether checkout pages offer it.",
  },
  {
    control: "each item, switch: … enabled",
    does: "Turns the method on or off at once.",
    operationIds: ["patchPaymentsMethodsByMethodKey"],
  },
  {
    control: "each item, button: Edit …",
    does: "Opens the method's editor.",
    operationIds: ["getPaymentsMethodsByMethodKey"],
  },
  {
    control: "heading: Add a payment method",
    does: "The Add a payment method dialog.",
  },
  {
    control:
      "paragraph: Pick the flow the customer goes through; you set its test values next. Flows are edited in Payments > Flows.",
    does: "Explains adding a method.",
    links:
      "[Advanced: create a payment method](../../advanced/payment-method.md).",
  },
  ...flowChoices.map(([radioName, flowDescription]): DeeperEntry => ({
    control: `radio: ${radioName}`,
    does: `The method runs this flow: ${flowDescription.charAt(0).toLowerCase()}${flowDescription.slice(1)}`,
  })),
  { control: "textbox: Name", does: "The name." },
  { control: "textbox: Key", does: "The key, fixed once added." },
  {
    control: "paragraph: Used by the API; fixed once added.",
    does: "Explains the key.",
  },
  {
    control: "button: Cancel",
    does: "Closes the dialog or editor without saving.",
  },
  {
    control: "button: Close",
    does: "Closes the dialog or editor without saving.",
  },
  {
    control: "heading: Card",
    does: "The method or flow open in the editor (here Card).",
  },
  {
    control: "paragraph: Card flow, key card",
    does: "The method's flow and key.",
  },
  {
    control: "textbox: Accent colour",
    does: "Picks the method's colour on checkout pages.",
  },
  { control: "textbox: Accent", does: "The colour as a hex value." },
  {
    control: "textbox: Test card # number",
    does: "A test card number the method accepts.",
  },
  {
    control: "combobox: Test card # outcome",
    does: "What that card does: succeed, decline, ask for 3-D Secure, and so on.",
  },
  { control: "button: Remove test card #", does: "Removes the test card." },
  { control: "button: Add test card", does: "Adds a test card." },
  {
    control: "button: Reset to default",
    does: "Brings back the shipped definition, after you confirm.",
  },
  {
    control: "button: Save method",
    does: "Saves the method.",
    operationIds: ["patchPaymentsMethodsByMethodKey"],
  },
  {
    control: "alert: Could not load the payment methods. Try again",
    does: "Shown when the methods could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the payment methods.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getPaymentsMethods"],
  },
];

/** Payments > Methods and the method editor. */
export const paymentsMethodsPage: DeeperPage = {
  screen: "/payments/methods",
  file: "payments/methods.md",
  title: "Methods in depth",
  description:
    "Every control and text of Payments > Methods and the method editor.",
  guidePage: "payments/methods.md",
  guideTitle: "Methods",
  intro:
    "Payments > Methods holds what customers pay with on test checkout pages, and the test values each accepts.",
  entries: methodEntries,
};
