import { expect, type Page } from "@playwright/test";

import type { DeeperOverlay } from "../deeper-screens";

/** Clicks the first row button whose name starts with the words, such as "Edit". */
async function clickFirstRowButton(page: Page, namePrefix: string) {
  await page
    .getByRole("button", { name: new RegExp(`^${namePrefix} `) })
    .first()
    .click();
}

function dialogOverlay(
  name: string,
  open: (page: Page) => Promise<void>,
): DeeperOverlay {
  return { name, open, scope: "dialog" };
}

/** An editor's tabs after its first, each recording what it adds to the first. */
function editorTabOverlays(
  editorName: string,
  openEditor: (page: Page) => Promise<void>,
  tabNames: string[],
): DeeperOverlay[] {
  return tabNames.map((tabName) => ({
    name: `${editorName}, ${tabName} tab`,
    open: async (page) => {
      await openEditor(page);
      await page.getByRole("tab", { name: tabName }).click();
    },
    scope: "dialog",
    baseline: `${editorName}, General tab`,
  }));
}

async function openEndpointEditor(page: Page) {
  await clickFirstRowButton(page, "Edit");
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
}

export const webhookOverviewOverlays: DeeperOverlay[] = [
  {
    name: "Shown as a table",
    open: (page) => page.getByRole("switch", { name: "Show as table" }).click(),
    scope: "screen",
  },
];

export const webhookEndpointOverlays: DeeperOverlay[] = [
  dialogOverlay("New endpoint editor", (page) =>
    page.getByRole("button", { name: "Add endpoint" }).click(),
  ),
  dialogOverlay("Endpoint editor, General tab", openEndpointEditor),
  ...editorTabOverlays("Endpoint editor", openEndpointEditor, [
    "Request",
    "Security",
    "Retries",
    "Variables",
  ]),
  dialogOverlay("Test sent dialog", (page) =>
    clickFirstRowButton(page, "Send test to"),
  ),
  dialogOverlay("Delete endpoint dialog", (page) =>
    clickFirstRowButton(page, "Delete"),
  ),
];

export const webhookRuleOverlays: DeeperOverlay[] = [
  dialogOverlay("New rule editor", (page) =>
    page.getByRole("button", { name: "Add rule" }).click(),
  ),
  dialogOverlay("Rule editor", (page) => clickFirstRowButton(page, "Edit")),
  dialogOverlay("Delete rule dialog", (page) =>
    clickFirstRowButton(page, "Delete"),
  ),
];

export const inboundRouteOverlays: DeeperOverlay[] = [
  dialogOverlay("New route editor", (page) =>
    page.getByRole("button", { name: "Add route" }).click(),
  ),
  dialogOverlay("Route editor", (page) => clickFirstRowButton(page, "Edit")),
];

async function openDelivery(page: Page) {
  await page.locator("tbody").getByRole("link").first().click();
  await expect(page.getByRole("dialog", { name: "Delivery" })).toBeVisible();
}

export const webhookDeliveryOverlays: DeeperOverlay[] = [
  dialogOverlay("A delivery is open", openDelivery),
];

export const webhookTemplateOverlays: DeeperOverlay[] = [
  dialogOverlay("A template is open", async (page) => {
    await page
      .locator("#main-content")
      .getByRole("listitem")
      .first()
      .getByRole("link")
      .first()
      .click();
  }),
  dialogOverlay("Import a template dialog", (page) =>
    page.getByRole("button", { name: "Import", exact: true }).click(),
  ),
  dialogOverlay("New template editor", (page) =>
    page.getByRole("button", { name: "New template" }).click(),
  ),
];

export const webhookVariableOverlays: DeeperOverlay[] = [
  dialogOverlay("New variable editor", (page) =>
    page.getByRole("button", { name: "Add variable" }).click(),
  ),
  dialogOverlay("Variable editor", (page) => clickFirstRowButton(page, "Edit")),
];

export const savedDeliveryOverlays: DeeperOverlay[] = [
  dialogOverlay("Send a saved delivery dialog", (page) =>
    clickFirstRowButton(page, "Send"),
  ),
];
