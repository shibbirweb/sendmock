import { expect, test } from "@playwright/test";

const emailList = "section[aria-label='Email list']";

test.beforeEach(async ({ page }) => {
  await page.goto("/mail");
  await expect(page.locator(emailList).getByRole("link").first()).toBeVisible();
});

test("EM-03.4 search filters narrow the list and chips toggle them", async ({
  page,
}) => {
  const listPanel = page.locator(emailList);
  await page.getByLabel("Search emails").fill("from:billing");
  await expect(listPanel.getByText("Invoice INV-2026-0042")).toBeVisible();
  await expect(listPanel.getByText("Reset your password")).toBeHidden();

  await page.getByLabel("Search emails").fill("");
  await page.getByRole("button", { name: "Attachments", exact: true }).click();
  await expect(page).toHaveURL(/q=has%3Aattachment/);
  await expect(listPanel.getByText("Reset your password")).toBeHidden();
});

test("EM-05.4 an opened email shows its code with a copy button", async ({
  page,
}) => {
  await page.locator(emailList).getByText("Your verification code").first().click();

  await expect(page.getByRole("heading", { name: "Your verification code", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy code 482913" })).toBeVisible();
});

test("EM-04.3 device toggles resize the HTML preview", async ({ page }) => {
  await page.locator(emailList).getByText("Welcome to Acme").click();
  const previewFrame = page.locator("iframe[title^='Preview']");
  const desktopWidth = (await previewFrame.boundingBox())?.width ?? 0;

  await page.getByRole("radio", { name: "Mobile width" }).click();
  await expect
    .poll(async () => (await previewFrame.boundingBox())?.width ?? 0)
    .toBeLessThan(desktopWidth);
  await expect.poll(async () => (await previewFrame.boundingBox())?.width ?? 0).toBeLessThanOrEqual(375);
});

test("EM-04.4 inline CID images load inside the sandboxed preview", async ({
  page,
}) => {
  await page.locator(emailList).getByText("Welcome to Acme").click();
  const heroImage = page.frameLocator("iframe[title^='Preview']").locator("img[alt='Hero']");

  await expect
    .poll(() => heroImage.evaluate((imageElement: HTMLImageElement) => imageElement.naturalWidth))
    .toBeGreaterThan(0);
});

test("J opens the next email and D deletes the open one", async ({ page }) => {
  await page.keyboard.press("j");
  await expect(page).toHaveURL(/\/mail\/[0-9A-Z]{26}$/);
  const openedSubject = await page.getByRole("heading", { level: 2 }).textContent();

  await page.keyboard.press("d");
  await expect(page.getByText("Email deleted").first()).toBeVisible();
  await expect(
    page.locator(emailList).getByText(openedSubject ?? "", { exact: true }),
  ).toBeHidden();
});

test("EM-16.2 notification permission is requested only when turned on", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const permissionRequests = { count: 0 };
    Object.assign(window, { permissionRequests });
    Notification.requestPermission = () => {
      permissionRequests.count += 1;
      return Promise.resolve("denied");
    };
  });
  await page.goto("/mail");
  await expect(page.locator(emailList).getByRole("link").first()).toBeVisible();

  const readRequestCount = () =>
    page.evaluate(
      () => (window as unknown as { permissionRequests: { count: number } }).permissionRequests.count,
    );
  expect(await readRequestCount()).toBe(0);

  await page.getByRole("button", { name: "Notify me about new emails" }).click();
  await expect.poll(readRequestCount).toBe(1);
});
