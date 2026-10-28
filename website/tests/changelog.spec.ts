import { expect, test } from "@playwright/test";

test("the changelog page says there are no releases until the first one", async ({
  page,
}) => {
  await page.goto("/changelog/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  await expect(page.getByTestId("changelog-empty")).toContainText(
    "No releases yet",
  );
});

test("the footer's What's new link opens the changelog", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "What's new" })
    .click();

  await expect(page).toHaveURL(/\/changelog\/?$/);
});
