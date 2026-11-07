import { expect, type Page } from "@playwright/test";

import type { DeeperOverlay } from "../deeper-screens";

function screenOverlay(
  name: string,
  open: (page: Page) => Promise<void>,
  baseline?: string,
): DeeperOverlay {
  return { name, open, scope: "screen", baseline };
}

function dialogOverlay(
  name: string,
  open: (page: Page) => Promise<void>,
): DeeperOverlay {
  return { name, open, scope: "dialog" };
}

async function openSlackBin(page: Page) {
  await page.getByRole("button", { name: /^slack Slack/ }).click();
  await expect(page.getByRole("heading", { name: "slack" })).toBeVisible();
}

async function openFirstRequest(page: Page) {
  await page
    .getByRole("button", { name: /^POST / })
    .first()
    .click();
}

export const httpCatcherOverlays: DeeperOverlay[] = [
  screenOverlay("A bin is open", openSlackBin),
  screenOverlay("A request is open", openFirstRequest),
  dialogOverlay("New bin dialog", (page) =>
    page.getByRole("button", { name: "New bin" }).click(),
  ),
];

export const numbersOverlays: DeeperOverlay[] = [
  screenOverlay("Messaging Services tab", (page) =>
    page.getByRole("tab", { name: "Messaging Services" }).click(),
  ),
  dialogOverlay("New number editor", (page) =>
    page.getByRole("button", { name: "Add number" }).click(),
  ),
  dialogOverlay("Number editor", (page) =>
    page
      .getByRole("button", { name: /^Edit \+/ })
      .first()
      .click(),
  ),
];

async function openFirstRowLink(page: Page) {
  await page.locator("tbody").getByRole("link").first().click();
}

async function openApiRequestsTab(page: Page) {
  await page.getByRole("tab", { name: "API requests" }).click();
  await expect(page.locator("tbody").getByRole("link").first()).toBeVisible();
}

export const logsOverlays: DeeperOverlay[] = [
  dialogOverlay("An SMTP session is open", openFirstRowLink),
  screenOverlay("API requests tab", openApiRequestsTab),
  dialogOverlay("An API request is open", async (page) => {
    await openApiRequestsTab(page);
    await openFirstRowLink(page);
  }),
];

async function loadExample(page: Page) {
  await page.getByRole("button", { name: "Load example" }).click();
}

export const scenariosOverlays: DeeperOverlay[] = [
  screenOverlay("An example is loaded", loadExample),
  screenOverlay(
    "The example has run",
    async (page) => {
      await loadExample(page);
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await expect(page.getByRole("status").last()).toBeVisible();
    },
    "An example is loaded",
  ),
];

const settingsSectionNames = [
  "Seed",
  "Email",
  "SMS",
  "Payments",
  "Notifications",
  "Opened events",
  "Chaos",
  "OTP patterns",
  "Connection",
  "About",
];

export const settingsOverlays: DeeperOverlay[] = [
  ...settingsSectionNames.map((sectionName) =>
    screenOverlay(`${sectionName} section`, (page) =>
      page
        .locator("#main-content")
        .getByRole("link", { name: sectionName, exact: true })
        .click(),
    ),
  ),
  ...["Delete all emails", "Delete all SMS", "Reset to seed"].map(
    (buttonName) =>
      dialogOverlay(`${buttonName} dialog`, (page) =>
        page.getByRole("button", { name: buttonName, exact: true }).click(),
      ),
  ),
];
