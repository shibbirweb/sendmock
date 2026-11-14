import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { gatewayEditorEntries } from "./payments-gateway-editor";

const gatewayListEntries: DeeperEntry[] = [
  {
    control: "heading: Gateways",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Gateways guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Gateways](../../payments/gateways.md).",
  },
  {
    control: "heading: Payment gateways",
    does: "The payment providers SendMock emulates.",
    operationIds: ["getPaymentsGateways"],
  },
  {
    control:
      "paragraph: The providers SendMock emulates: what their checkout offers, what they send back to your app, and the notifications they post.",
    does: "Explains the screen.",
  },
  {
    control: "button: Add gateway",
    does: "Opens Add a payment gateway; in it, adds the gateway.",
    operationIds: ["postPaymentsGateways"],
  },
  { control: "columnheader: Gateway", does: "The gateway's name." },
  {
    control: "columnheader: Key",
    does: "Its key: the `provider` value in the API and its `/providers/<key>/` paths.",
  },
  {
    control: "columnheader: Methods offered",
    does: "The payment methods its checkout offers.",
  },
  {
    control: "columnheader: Notifications to",
    does: "The webhook endpoint its notifications go to.",
  },
  { control: "columnheader: Enabled", does: "Whether it takes payments." },
  {
    control: "each item, switch: … enabled",
    does: "Turns the gateway on or off at once.",
    operationIds: ["patchPaymentsGatewaysByGatewayKey"],
  },
  {
    control: "each item, button: Edit …",
    does: "Opens the gateway's editor.",
    operationIds: ["getPaymentsGatewaysByGatewayKey"],
  },
  {
    control: "alert: Could not load the gateways. Try again",
    does: "Shown when the gateways could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the gateways.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getPaymentsGateways"],
  },
  {
    control: "heading: Add a payment gateway",
    does: "The Add a payment gateway dialog.",
  },
  {
    control:
      "paragraph: Emulate a provider SendMock does not ship; you set its checkout, redirect and notification next.",
    does: "Explains adding a gateway.",
    links:
      "[Advanced: create a payment gateway](../../advanced/payment-gateway.md).",
  },
  { control: "textbox: Name", does: "The gateway's name." },
  { control: "textbox: Key", does: "Its key, fixed once added." },
  {
    control: "paragraph: The provider value in the API; fixed once added.",
    does: "Explains the key.",
  },
  {
    control: "combobox: Start from",
    does: "Blank, or a built-in gateway to copy.",
  },
  {
    control: "button: Cancel",
    does: "Closes the dialog or editor without saving.",
  },
  {
    control: "button: Close",
    does: "Closes the dialog or editor without saving.",
  },
];

/** Payments > Gateways and the gateway editor. */
export const paymentsGatewaysPage: DeeperPage = {
  screen: "/payments/gateways",
  file: "payments/gateways.md",
  title: "Gateways in depth",
  description:
    "Every control and text of Payments > Gateways and the gateway editor's tabs.",
  guidePage: "payments/gateways.md",
  guideTitle: "Gateways",
  intro:
    "Payments > Gateways holds the payment providers SendMock emulates: their checkout, redirect and notifications.",
  entries: [...gatewayListEntries, ...gatewayEditorEntries],
};
