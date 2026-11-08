import { expect, test } from "@playwright/test";

test("DS-05.4 the changelog page shows what the newest beta holds, and no stable release yet", async ({
  page,
}) => {
  await page.goto("/changelog/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  const unreleased = page
    .getByTestId("changelog-release")
    .filter({ has: page.getByRole("heading", { name: /^Unreleased/ }) });
  await expect(unreleased).toContainText("in the newest beta");
  await expect(unreleased.getByRole("listitem").first()).toBeVisible();
  // The Markdown of an entry is formatted, not shown as asterisks.
  await expect(unreleased.locator("strong").first()).toBeVisible();
  await expect(unreleased).not.toContainText("**");
  await expect(page.getByTestId("changelog-empty")).toContainText(
    "No stable release yet",
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
