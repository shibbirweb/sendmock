import { expect, type Page } from "@playwright/test";

import type { DeeperOverlay } from "../deeper-screens";

function dialogOverlay(
  name: string,
  open: (page: Page) => Promise<void>,
  baseline?: string,
): DeeperOverlay {
  return { name, open, scope: "dialog", baseline };
}

/** The first payment with a status filter on, such as Succeeded or Disputed. */
async function openPayment(page: Page, statusFilter: string) {
  await page.getByRole("button", { name: statusFilter, exact: true }).click();
  await page.locator("tbody").getByRole("link").first().click();
  await expect(page.getByRole("dialog", { name: "Payment" })).toBeVisible();
}

async function chooseSimulateAction(page: Page, actionName: RegExp) {
  await page.getByRole("button", { name: "Simulate" }).click();
  await page.getByRole("menuitem", { name: actionName }).first().click();
}

export const paymentListOverlays: DeeperOverlay[] = [
  dialogOverlay("New payment dialog", (page) =>
    page.getByRole("button", { name: "New payment" }).click(),
  ),
  dialogOverlay("A payment is open", (page) => openPayment(page, "Succeeded")),
  {
    name: "Simulate menu",
    open: async (page) => {
      await openPayment(page, "Succeeded");
      await page.getByRole("button", { name: "Simulate" }).click();
    },
    scope: "menu",
  },
  dialogOverlay("Refund payment dialog", async (page) => {
    await openPayment(page, "Succeeded");
    await chooseSimulateAction(page, /^Refund/);
  }),
  dialogOverlay("Answer dispute dialog", async (page) => {
    await openPayment(page, "Disputed");
    await chooseSimulateAction(page, /Answer/);
  }),
];

/** The first row's editor on a gateways, methods or flows screen. */
async function openFirstEditor(page: Page) {
  await page
    .getByRole("button", { name: /^Edit / })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

export const paymentGatewayOverlays: DeeperOverlay[] = [
  dialogOverlay("Add a payment gateway dialog", (page) =>
    page.getByRole("button", { name: "Add gateway" }).click(),
  ),
  dialogOverlay("Gateway editor", openFirstEditor),
  ...["Checkout", "Merchant", "Redirect", "Notification"].map((tabName) =>
    dialogOverlay(
      `Gateway editor, ${tabName} tab`,
      async (page) => {
        await openFirstEditor(page);
        await page.getByRole("tab", { name: tabName }).click();
      },
      "Gateway editor",
    ),
  ),
];

export const paymentMethodOverlays: DeeperOverlay[] = [
  dialogOverlay("Add a payment method dialog", (page) =>
    page.getByRole("button", { name: "Add method" }).click(),
  ),
  dialogOverlay("Method editor", openFirstEditor),
];

export const paymentFlowOverlays: DeeperOverlay[] = [
  dialogOverlay("Add a payment flow dialog", (page) =>
    page.getByRole("button", { name: "Add flow" }).click(),
  ),
  dialogOverlay("Flow editor", openFirstEditor),
];

export const subscriptionOverlays: DeeperOverlay[] = [
  dialogOverlay("New subscription dialog", (page) =>
    page.getByRole("button", { name: "New subscription" }).click(),
  ),
];
