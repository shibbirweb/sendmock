import { expect, test } from "@playwright/test";

test("WS-03.3 search finds a docs page in the static site's index and opens it", async ({
  page,
}) => {
  const searchRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/search")) {
      searchRequests.push(request.url());
    }
  });
  await page.goto("/docs/");

  await page
    .getByRole("button", { name: /search/i })
    .first()
    .click();
  const searchDialog = page.getByRole("dialog");
  await searchDialog.getByRole("textbox").fill("Magic numbers and addresses");
  const pageResult = searchDialog
    .getByText("Magic numbers and addresses", { exact: true })
    .first();
  await expect(pageResult).toBeVisible();
  await pageResult.click();

  await expect(page).toHaveURL(/\/docs\/reference\/magic-numbers\/?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Magic numbers and addresses",
  );
  // The static export has no server: the browser downloads the prebuilt index once and
  // searches it locally, so no request carries the query.
  expect(searchRequests.length).toBeGreaterThan(0);
  expect(
    searchRequests.every((requestUrl) => !requestUrl.includes("Magic")),
  ).toBe(true);
});
