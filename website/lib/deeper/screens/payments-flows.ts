import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { methodEntries } from "./payments-methods";

const flowEntries: DeeperEntry[] = [
  { control: "heading: Flows", does: "Names the open screen in the header." },
  {
    control: "link: Read the Flows guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Flows](../../payments/flows.md).",
  },
  {
    control: "heading: Payment flows",
    does: "The steps checkout pages run.",
    operationIds: ["getPaymentsFlows"],
  },
  {
    control:
      "paragraph: The steps a customer goes through on test checkout pages. Each method runs one flow.",
    does: "Explains the screen.",
  },
  {
    control: "button: Add flow",
    does: "Opens Add a payment flow; in it, adds the flow.",
    operationIds: ["postPaymentsFlows"],
  },
  { control: "columnheader: Flow", does: "The flow's name." },
  { control: "columnheader: Steps", does: "Its steps, in order." },
  {
    control: "columnheader: Picker tab",
    does: "The tab its methods show under on checkout pages.",
  },
  { control: "columnheader: Methods", does: "The methods that run it." },
  ...[
    "Card",
    "Wallet",
    "Bank",
    "Account",
    "QR",
    "Bank transfer",
    "Voucher",
  ].map((flowName): DeeperEntry => ({
    control: `button: Edit ${flowName}`,
    does: `Opens the ${flowName} flow's editor.`,
    operationIds: ["getPaymentsFlowsByFlowKey"],
  })),
  {
    control: "heading: Add a payment flow",
    does: "The Add a payment flow dialog.",
  },
  {
    control:
      "paragraph: Name it and pick where to start; you compose its steps next.",
    does: "Explains adding a flow.",
    links: "[Advanced: create a payment flow](../../advanced/payment-flow.md).",
  },
  {
    control: "textbox: Picker tab",
    does: "The tab its methods show under on checkout pages.",
  },
  {
    control:
      "paragraph: Its methods show under this tab on checkout pages, e.g. Mobile banking.",
    does: "Explains the picker tab.",
  },
  {
    control: "paragraph: Its methods show under this tab on checkout pages.",
    does: "Explains the picker tab.",
  },
  { control: "combobox: Start from", does: "Blank, or a flow to copy." },
  {
    control: "button: Add flow",
    state: "Add a payment flow dialog",
    does: "Adds the flow and opens its editor.",
    operationIds: ["postPaymentsFlows"],
  },
  {
    control: "paragraph: Flow, key card . Used by Card.",
    does: "The flow's key and the methods that use it.",
  },
  {
    control: "columnheader: Variable",
    does: "A value the steps' texts can use.",
  },
  { control: "columnheader: Becomes", does: "What it reads from the payment." },
  {
    control: "columnheader: Example",
    does: "An example of its value.",
    operationIds: ["getPaymentsFlowVariables"],
  },
  { control: "heading: Steps", does: "The flow's steps." },
  {
    control: "paragraph: The checkout page runs them in this order.",
    does: "Explains the step order.",
  },
  {
    control: "button: Add step",
    does: "Adds a step: a form, a code, a confirmation, a QR code, and so on.",
    operationIds: ["postPaymentsFlowsByFlowKeySteps"],
  },
  {
    control: "button: Move Step #: Card form up",
    does: "Runs the step earlier.",
  },
  {
    control: "button: Move Step #: Card form down",
    does: "Runs the step later.",
  },
  {
    control: "button: Remove Step #: Card form",
    does: "Removes the step.",
    operationIds: ["deletePaymentsFlowsByFlowKeyStepsByStepIndex"],
  },
  { control: "textbox: Title", does: "The step's title on the checkout page." },
  { control: "textbox: Field label", does: "The label of its field." },
  { control: "textbox: Hint", does: "A hint under the field." },
  { control: "textbox: Button text", does: "Its button's text." },
  ...["title", "field label", "hint", "button text"].map(
    (textName): DeeperEntry => ({
      control: `button: Insert variable into Step #: Card form ${textName}`,
      does: `Inserts a flow variable, such as the amount, into the ${textName}.`,
    }),
  ),
  {
    control: "paragraph: Preview: Card number · [Pay BDT #,#.#]",
    does: "How the step looks on a checkout page.",
  },
  {
    control: "button: Save flow",
    does: "Saves the flow; methods using it change at once.",
    operationIds: ["patchPaymentsFlowsByFlowKey"],
  },
  {
    control: "alert: Could not load the payment flows. Try again",
    does: "Shown when the flows could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the payment flows.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getPaymentsFlows"],
  },
];

/** Payments > Flows and the flow editor. */
export const paymentsFlowsPage: DeeperPage = {
  screen: "/payments/flows",
  file: "payments/flows.md",
  title: "Flows in depth",
  description:
    "Every control and text of Payments > Flows and the flow editor.",
  guidePage: "payments/flows.md",
  guideTitle: "Flows",
  intro:
    "Payments > Flows holds the steps a customer goes through on test checkout pages.",
  entries: [
    ...flowEntries,
    ...methodEntries.filter((methodEntry) =>
      [
        "textbox: Name",
        "textbox: Key",
        "paragraph: Used by the API; fixed once added.",
        "button: Cancel",
        "button: Close",
        "button: Reset to default",
        "heading: Card",
      ].includes(methodEntry.control),
    ),
  ],
};
