import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { appScreens, navigateInApp } from "./support/app-screens";

const screenPaths = appScreens.map((appScreen) => appScreen.path);

/** Serious or critical WCAG A / AA violations, as "rule: element" lines. */
async function findSeriousViolations(
  page: Page,
  includeSelector?: string,
): Promise<string[]> {
  let axeBuilder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Toasts come and go with live traffic; they are scanned on their own.
    .exclude("[data-sonner-toaster]");
  if (includeSelector !== undefined) {
    axeBuilder = axeBuilder.include(includeSelector);
  }
  const axeResults = await axeBuilder.analyze();

  return axeResults.violations
    .filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    )
    .flatMap((violation) =>
      violation.nodes.map(
        (violationNode) => `${violation.id}: ${violationNode.target.join(" ")}`,
      ),
    );
}

async function openApp(page: Page, colorScheme: "light" | "dark") {
  // Reduced motion settles transitions at once, so nothing is scanned mid-fade.
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(
    (themeName) => localStorage.setItem("sendmock.theme", themeName),
    colorScheme,
  );
  await page.reload();
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`UI-05.2 UI-05.3 no serious or critical axe issues on any screen, ${colorScheme} theme`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openApp(page, colorScheme);
    for (const screenPath of screenPaths) {
      await navigateInApp(page, screenPath);
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
      expect(await findSeriousViolations(page), screenPath).toEqual([]);
    }
  });
}

/** How to open each screen's main sheet, dialog or popover. */
const overlaySteps: [string, string, (page: Page) => Promise<void>][] = [
  [
    "/webhooks/endpoints",
    "Add endpoint",
    (page) =>
      page.getByRole("button", { name: "Add endpoint" }).first().click(),
  ],
  [
    "/webhooks/rules",
    "Add rule",
    (page) => page.getByRole("button", { name: "Add rule" }).first().click(),
  ],
  [
    "/webhooks/inbound-routes",
    "Add route",
    (page) => page.getByRole("button", { name: "Add route" }).click(),
  ],
  [
    "/webhooks/variables",
    "Add variable",
    (page) =>
      page.getByRole("button", { name: "Add variable" }).first().click(),
  ],
  [
    "/payments/gateways",
    "Edit SSLCommerz",
    (page) => page.getByRole("button", { name: "Edit SSLCommerz" }).click(),
  ],
  [
    "/payments/methods",
    "Edit bKash",
    (page) => page.getByRole("button", { name: "Edit bKash" }).click(),
  ],
  [
    "/payments/flows",
    "Edit Wallet",
    (page) =>
      page.getByRole("button", { name: "Edit Wallet", exact: true }).click(),
  ],
  [
    "/numbers",
    "Add number",
    (page) => page.getByRole("button", { name: "Add number" }).first().click(),
  ],
  [
    "/",
    "Keyboard shortcuts",
    (page) => page.getByRole("button", { name: "Keyboard shortcuts" }).click(),
  ],
  [
    "/",
    "Notifications",
    (page) => page.getByRole("button", { name: /^Notifications/ }).click(),
  ],
];

test("UI-05.2 the main sheets, dialogs and popovers have no serious or critical axe issues", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page, "light");
  for (const [screenPath, overlayName, openOverlay] of overlaySteps) {
    await navigateInApp(page, screenPath);
    await openOverlay(page);
    const overlay = page
      .locator('[role="dialog"], [data-slot="popover-content"]')
      .last();
    await expect(overlay).toBeVisible();
    await page.waitForTimeout(300);
    expect(await findSeriousViolations(page), overlayName).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  }
});

test("UI-05.3 a settled toast meets contrast in both themes", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await openApp(page, colorScheme);
    await page.getByRole("button", { name: "Demo controls" }).click();
    await page.getByRole("button", { name: "Sample email" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    await page.waitForTimeout(600);
    const axeResults = await new AxeBuilder({ page })
      .include("[data-sonner-toaster]")
      .withRules(["color-contrast"])
      .analyze();
    expect(axeResults.violations, colorScheme).toEqual([]);
  }
});
