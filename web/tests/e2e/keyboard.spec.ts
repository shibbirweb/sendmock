import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

/** Whether the focused element shows a focus ring or outline. */
async function hasVisibleFocus(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const focusedElement = document.activeElement;
    if (focusedElement === null || focusedElement === document.body) {
      return false;
    }
    const focusStyle = getComputedStyle(focusedElement);

    return (
      focusStyle.outlineStyle !== "none" || focusStyle.boxShadow !== "none"
    );
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
});

test("UI-05.1 the first tab stop skips to the content, and focus is always visible", async ({
  page,
}) => {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
    await page.keyboard.press("Tab");
    expect(await hasVisibleFocus(page), `tab stop ${tabIndex + 1}`).toBe(true);
  }
});

test("UI-05.1 a sheet traps focus and gives it back to the button that opened it", async ({
  page,
}) => {
  await navigateInApp(page, "/payments/gateways");
  const editButton = page.getByRole("button", { name: "Edit SSLCommerz" });
  await editButton.focus();
  await page.keyboard.press("Enter");
  const gatewaySheet = page.getByRole("dialog", { name: "SSLCommerz" });
  await expect(gatewaySheet).toBeVisible();
  for (let tabIndex = 0; tabIndex < 25; tabIndex++) {
    await page.keyboard.press("Tab");
    await expect(gatewaySheet.locator(":focus")).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
  await expect(gatewaySheet).toBeHidden();
  await expect(editButton).toBeFocused();
});

test("UI-05.1 the command palette opens any screen from the keyboard", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("Gateways");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/payments\/gateways$/);
  await expect(page).toHaveTitle("Gateways · Payments · SendMock");
});

test("UI-05.1 an SMS reply is written and sent with the keyboard", async ({
  page,
}) => {
  await navigateInApp(page, "/sms");
  await expect(
    page
      .locator("section[aria-label='Conversation list']")
      .getByRole("link")
      .first(),
  ).toBeVisible();
  await page.keyboard.press("j");
  await expect(page).toHaveURL(/\/sms\/.+/);
  const replyBox = page.getByLabel(/^Reply as /);
  await replyBox.focus();
  await page.keyboard.type("Sent from the keyboard");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Sent from the keyboard")).toBeVisible();
});

test("UI-05.1 a payment flow step is edited and saved with the keyboard", async ({
  page,
}) => {
  await navigateInApp(page, "/payments/flows");
  await page.getByRole("button", { name: "Edit Wallet", exact: true }).focus();
  await page.keyboard.press("Enter");
  const flowSheet = page.getByRole("dialog", { name: "Wallet" });
  const otpLabel = flowSheet
    .getByRole("listitem", { name: "Step 2: OTP" })
    .getByLabel("Field label", { exact: true });
  await otpLabel.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("SMS code");
  await flowSheet.getByRole("button", { name: "Save flow" }).focus();
  await page.keyboard.press("Enter");
  await expect(flowSheet).toBeHidden();
  await expect(
    page.getByTestId("payment-flow-row").filter({ hasText: "Wallet" }).first(),
  ).toContainText("Modified");
});

test("UI-05.1 a setting is switched with the keyboard", async ({ page }) => {
  await navigateInApp(page, "/settings?section=notifications");
  const toastSwitch = page.getByLabel("Show pop-up toasts");
  await toastSwitch.focus();
  await page.keyboard.press("Space");
  await expect(toastSwitch).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(toastSwitch).toBeChecked();
});

test("UI-05.4 with reduced motion, sheets open without animating", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await navigateInApp(page, "/payments/gateways");
  await page.getByRole("button", { name: "Edit SSLCommerz" }).click();
  const sheetTiming = await page
    .locator('[data-slot="sheet-content"]')
    .evaluate((sheetElement) => {
      const sheetStyle = getComputedStyle(sheetElement);
      return {
        animationDuration: parseFloat(sheetStyle.animationDuration),
        transitionDuration: parseFloat(sheetStyle.transitionDuration),
      };
    });

  expect(sheetTiming.animationDuration).toBeLessThan(0.001);
  expect(sheetTiming.transitionDuration).toBeLessThan(0.001);
  const skeletonPulse = await page.evaluate(() => {
    const skeletonElement = document.createElement("div");
    skeletonElement.className = "animate-pulse";
    document.body.append(skeletonElement);
    const pulseDuration = parseFloat(
      getComputedStyle(skeletonElement).animationDuration,
    );
    skeletonElement.remove();
    return pulseDuration;
  });
  expect(skeletonPulse).toBeLessThan(0.001);
});
