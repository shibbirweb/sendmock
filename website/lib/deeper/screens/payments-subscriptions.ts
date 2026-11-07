import type { DeeperEntry, DeeperPage } from "../deeper-types";

const subscriptionEntries: DeeperEntry[] = [
  {
    control: "heading: Subscriptions",
    does: "Names the screen, in the header and above the list.",
  },
  {
    control: "link: Read the Subscriptions guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Subscriptions](../../payments/subscriptions.md).",
  },
  {
    control:
      "paragraph: Each subscription keeps its own clock: advance it to charge the next renewal through its gateway, or cancel it.",
    does: "Explains the screen: renewals happen when you advance a subscription's clock, not on the calendar.",
    operationIds: ["getPaymentsSubscriptions"],
  },
  { control: "button: New subscription", does: "Opens New subscription." },
  {
    control: "paragraph: No subscriptions yet",
    does: "Shown while there is none.",
  },
  {
    control:
      "paragraph: Start one with New subscription, or POST /api/v#/payments/subscriptions, to test renewals, failed payments and cancellations.",
    does: "Explains how to start one.",
  },
  {
    control: "heading: New subscription",
    does: "The New subscription dialog.",
  },
  {
    control: "paragraph: Without a trial the first period is charged at once.",
    does: "Explains the first charge.",
  },
  {
    control: "combobox: Gateway",
    does: "The gateway renewals are charged through.",
  },
  {
    control: "combobox: Interval",
    does: "How often it renews: daily, weekly, monthly or yearly.",
  },
  { control: "textbox: Customer email", does: "The customer's email." },
  { control: "textbox: Plan name", does: "The plan's name." },
  { control: "textbox: Amount", does: "What each period costs." },
  { control: "textbox: Currency", does: "The currency code." },
  {
    control: "textbox: Trial days",
    does: "Free days before the first charge.",
  },
  {
    control: "textbox: Test card",
    does: "The test card renewals use; a declining card makes renewals fail.",
  },
  {
    control: "button: Cancel",
    does: "Closes the dialog without doing anything.",
  },
  {
    control: "button: Start subscription",
    does: "Starts the subscription.",
    changes:
      "Fires `subscription.created`, and a payment for the first period when there is no trial.",
    operationIds: ["postPaymentsSubscriptions"],
  },
  { control: "button: Close", does: "Closes the dialog." },
  {
    control: "alert: Could not load the subscriptions. Try again",
    does: "Shown when the subscriptions could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the subscriptions.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads them again.",
    operationIds: ["getPaymentsSubscriptions"],
  },
];

/** Payments > Subscriptions. */
export const paymentsSubscriptionsPage: DeeperPage = {
  screen: "/payments/subscriptions",
  file: "payments/subscriptions.md",
  title: "Subscriptions in depth",
  description:
    "Every control and text of Payments > Subscriptions and New subscription.",
  guidePage: "payments/subscriptions.md",
  guideTitle: "Subscriptions",
  intro:
    "Payments > Subscriptions tests renewals, failed renewal payments and cancellations, each subscription on its own clock.",
  entries: subscriptionEntries,
};
