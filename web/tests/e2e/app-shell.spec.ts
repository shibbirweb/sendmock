import { expect, type Page, test } from "@playwright/test";

const consoleErrorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const consoleErrors: string[] = [];
  consoleErrorsByPage.set(page, consoleErrors);
  page.on("console", (consoleMessage) => {
    if (consoleMessage.type() === "error") {
      consoleErrors.push(consoleMessage.text());
    }
  });
  page.on("pageerror", (pageError) => {
    consoleErrors.push(pageError.message);
  });

  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Live");
});

/** Tests that provoke API errors on purpose add this annotation. */
const expectedConsoleErrorsAnnotation = "expects-console-errors";

test.afterEach(({ page }, testInfo) => {
  const isExpectingConsoleErrors = testInfo.annotations.some(
    (annotation) => annotation.type === expectedConsoleErrorsAnnotation,
  );

  if (!isExpectingConsoleErrors) {
    expect(consoleErrorsByPage.get(page) ?? []).toEqual([]);
  }
});

test("UI-01.1 sidebar lists every section and highlights the current one", async ({
  page,
}) => {
  const sidebar = page.locator("[data-sidebar='sidebar']");

  for (const sectionTitle of [
    "Overview",
    "Mail",
    "SMS",
    "HTTP",
    "Webhooks",
    "Numbers",
    "Logs",
    "Settings",
  ]) {
    await expect(
      sidebar.getByRole("link", { name: sectionTitle, exact: true }),
    ).toBeVisible();
  }

  await sidebar.getByRole("link", { name: "SMS", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SMS");
  await expect(sidebar.getByRole("link", { name: "Verify" })).toBeVisible();
});

test("UI-01.2 theme can be switched and the choice persists", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("UI-01.3 keyboard shortcuts navigate and open the palette and help", async ({
  page,
}) => {
  await page.keyboard.press("g");
  await page.keyboard.press("m");
  await expect(page).toHaveURL(/\/mail$/);

  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Type a page or an action...").fill("logs");
  // Wait for the filter to settle; pressing Enter earlier selects the first item.
  await expect(page.getByRole("option", { name: /Logs/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/logs$/);
});

test("the command palette title is only in the page while the palette is open", async ({
  page,
}) => {
  const paletteTitle = page.getByRole("heading", { name: "Command palette" });

  await page.keyboard.press("ControlOrMeta+k");
  await expect(paletteTitle).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(paletteTitle).toHaveCount(0);
});

test("UI-01.4 sidebar shows the live connection status and version", async ({
  page,
}) => {
  await expect(page.getByRole("status")).toContainText("Live · demo data");
  await expect(page.getByRole("status")).toContainText("v0.0.0-dev");
});

test("UI-02.1 every screen renders in mock mode without a backend", async ({
  page,
}) => {
  for (const screenPath of [
    "/mail",
    "/sms",
    "/sms/verify",
    "/http",
    "/webhooks/endpoints",
    "/webhooks/deliveries",
    "/numbers",
    "/logs",
    "/settings",
  ]) {
    await page.goto(screenPath);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
      "Not found",
    );
  }
});

test("UI-02.3 demo controls add traffic that appears live", async ({
  page,
}) => {
  const emailCard = page.getByRole("link", { name: /Emails/ });
  const emailCountBefore = Number(
    await emailCard.locator(".text-2xl").textContent(),
  );

  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Sample email" }).click();

  await expect(emailCard.locator(".text-2xl")).toHaveText(
    String(emailCountBefore + 1),
  );
  await expect(page.getByText("New email")).toBeVisible();
});

test("notification toasts can be dismissed with their close button", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Sample email" }).click();
  await page.keyboard.press("Escape");

  const newEmailToast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "New email" });
  await expect(newEmailToast).toBeVisible();
  await newEmailToast.hover();
  await newEmailToast.getByRole("button", { name: /close/i }).click();
  await expect(newEmailToast).toBeHidden();
});

test("grouped notification toasts can all be cleared at once", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Demo controls" }).click();
  const sampleEmailButton = page.getByRole("button", { name: "Sample email" });
  await sampleEmailButton.click();
  await expect(page.getByRole("button", { name: /Clear all/ })).toBeHidden();
  await sampleEmailButton.click();
  await sampleEmailButton.click();
  await page.keyboard.press("Escape");

  const clearAllButton = page.getByRole("button", { name: "Clear all (3)" });
  await expect(clearAllButton).toBeVisible();
  await clearAllButton.click();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(clearAllButton).toBeHidden();
});

test("the sidebar and browser tab show the SendMock logo", async ({
  page,
  request,
}) => {
  const homeLink = page.getByRole("link", { name: /SendMock/ }).first();
  await expect(homeLink.locator("svg")).toBeVisible();

  const faviconPath = await page
    .locator("link[rel='icon']")
    .getAttribute("href");
  expect(faviconPath).toMatch(/favicon\.svg$/);
  const faviconResponse = await request.get(faviconPath ?? "");
  expect(faviconResponse.ok()).toBe(true);
  expect(await faviconResponse.text()).toContain("<svg");
});

test("UI-02.3 simulated server errors show an error state", async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({ type: expectedConsoleErrorsAnnotation });
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Always 500 server error" }).click();

  await expect(page.getByText("Could not load the overview")).toBeVisible();
});
