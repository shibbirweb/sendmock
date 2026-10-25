import { expect, test } from "@playwright/test";

async function readCursor(
  page: import("@playwright/test").Page,
  selector: string,
) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).cursor);
}

test("buttons, tabs, links and menu items show the pointer cursor", async ({
  page,
}) => {
  await page.goto("/sms/verify");
  await expect(page.locator("tbody tr").first()).toBeVisible();

  expect(await readCursor(page, "[role='tab']")).toBe("pointer");
  expect(await readCursor(page, "button[aria-label^='Copy code']")).toBe(
    "pointer",
  );
  expect(await readCursor(page, "button[aria-pressed]")).toBe("pointer");
  expect(await readCursor(page, "tbody a")).toBe("pointer");

  await page.goto("/mail");
  await page.locator("section[aria-label='Email list'] a").first().click();
  await page.getByRole("button", { name: "More actions" }).click();
  expect(await readCursor(page, "[role='menuitem']")).toBe("pointer");
});

test("disabled buttons keep the default cursor", async ({ page }) => {
  await page.goto("/mail");
  await page.locator("section[aria-label='Email list'] a").first().click();
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  expect(
    await page
      .getByRole("button", { name: "Send reply" })
      .evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("pointer");
});
