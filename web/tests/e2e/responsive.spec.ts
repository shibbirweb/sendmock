import { expect, type Page, test } from "@playwright/test";

import { appScreens, navigateInApp } from "./support/app-screens";

/** Phone, large phone, tablet, laptop, desktop, wide and 4K widths (U3 W4). */
const viewportWidths = [360, 390, 768, 1024, 1280, 1440, 2560];

/**
 * Elements that run past the right edge of the viewport, as "tag.class"
 * lines. Content inside an intentional horizontal scroller (`overflow-x-auto`,
 * a table container or `pre`) is allowed; anything else is a layout bug.
 */
async function findElementsPastViewport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const isInsideHorizontalScroller = (element: Element) =>
      element.parentElement?.closest(
        ".overflow-x-auto, [data-slot='table-container'], pre",
      ) !== null;
    const describeElement = (element: Element) =>
      `${element.tagName.toLowerCase()}.${String(
        element.getAttribute("class") ?? "",
      )
        .split(" ")
        .slice(0, 4)
        .join(".")}`;

    return Array.from(document.querySelectorAll("body *"))
      .filter((element) => element.closest("[data-sonner-toaster]") === null)
      .filter((element) => {
        const elementBox = element.getBoundingClientRect();
        return (
          elementBox.width > 0 &&
          elementBox.height > 0 &&
          elementBox.right > viewportWidth + 1 &&
          !isInsideHorizontalScroller(element)
        );
      })
      .map(describeElement)
      .slice(0, 5);
  });
}

async function hasPageHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const viewportWidth of viewportWidths) {
  test(`UI-01.1 every screen fits ${viewportWidth} px wide with no horizontal scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.goto("/");
    await expect(page.getByText("Activity, last 24 hours")).toBeVisible();

    for (const appScreen of appScreens) {
      await navigateInApp(page, appScreen.path);
      await expect(page).toHaveTitle(appScreen.title);
      await expect(page.locator("[data-slot='skeleton']")).toHaveCount(0);
      expect(
        await findElementsPastViewport(page),
        `${appScreen.path} at ${viewportWidth} px`,
      ).toEqual([]);
      expect(await hasPageHorizontalScroll(page)).toBe(false);
    }
  });
}

test("UI-01.1 the sidebar is a rail on desktop and a drawer on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/mail");
  const sidebarLink = page.getByRole("link", { name: "SMS", exact: true });
  await expect(sidebarLink).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(sidebarLink).toBeHidden();
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(sidebarLink).toBeVisible();
  await sidebarLink.click();
  await expect(page).toHaveTitle("SMS · SendMock");
  await expect(sidebarLink).toBeHidden();
});

const editingSheets = [
  { path: "/webhooks/endpoints", openButton: "Add endpoint" },
  { path: "/webhooks/rules", openButton: "Add rule" },
  { path: "/webhooks/inbound-routes", openButton: "Add route" },
  { path: "/payments/flows", openButton: "Edit Wallet" },
  { path: "/payments/gateways", openButton: "Edit SSLCommerz" },
  { path: "/payments/methods", openButton: "Add method" },
];

test("UI-01.1 editing sheets fit a 360 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();

  for (const editingSheet of editingSheets) {
    await navigateInApp(page, editingSheet.path);
    await page
      .getByRole("button", { name: editingSheet.openButton, exact: true })
      .first()
      .click();
    const sheetDialog = page.getByRole("dialog");
    await expect(sheetDialog).toBeVisible();
    for (const tabName of await sheetDialog.getByRole("tab").allInnerTexts()) {
      const sheetTab = sheetDialog.getByRole("tab", {
        name: tabName,
        exact: true,
      });
      if (await sheetTab.isEnabled()) {
        await sheetTab.click();
      }
      await expect
        .poll(() => findElementsPastViewport(page), {
          message: `${editingSheet.openButton}, ${tabName} tab`,
        })
        .toEqual([]);
    }
    await expect
      .poll(() => findElementsPastViewport(page), {
        message: editingSheet.openButton,
      })
      .toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheetDialog).toBeHidden();
  }
});

test("UI-01.1 a checkout page stacks the order summary above the payment panel on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/payments");
  const paymentHref = await page
    .getByTestId("payment-row")
    .first()
    .getByRole("link")
    .getAttribute("href");
  const paymentId = new URL(
    paymentHref ?? "",
    "http://localhost",
  ).searchParams.get("payment");
  await navigateInApp(page, `/pay/${paymentId}`);

  const orderSummary = page.getByRole("region", { name: "Order summary" });
  const paymentPanel = page.locator("main > *").nth(1);
  await expect(orderSummary).toBeVisible();
  const summaryBox = await orderSummary.boundingBox();
  const panelBox = await paymentPanel.boundingBox();
  expect(summaryBox?.y ?? 0).toBeLessThan(panelBox?.y ?? 0);
  expect(await findElementsPastViewport(page)).toEqual([]);
  expect(await hasPageHorizontalScroll(page)).toBe(false);
});
