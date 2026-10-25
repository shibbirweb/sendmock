import { expect, type Page, test } from "@playwright/test";

/** Switches the mock API to no traffic; a reload would bring the demo data back. */
async function switchToEmptyDataSet(page: Page) {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Empty (no traffic)" }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await page.keyboard.press("Escape");
}

/** Client-side navigation, so the in-browser mock data survives. */
async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

test("UI-04.1 every empty list shows how to connect with this instance's host and ports", async ({
  page,
}) => {
  await page.goto("/mail");
  await switchToEmptyDataSet(page);

  await expect(page.getByText("No emails yet")).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: /^127\.0\.0\.1$/ }),
  ).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^1025$/ })).toBeVisible();

  await navigateInApp(page, "/sms");
  await expect(page.getByText("No SMS yet")).toBeVisible();
  await expect(
    page.getByText("http://127.0.0.1:8025/api/v1/sms"),
  ).toBeVisible();

  await navigateInApp(page, "/sms/verify");
  await expect(page.getByText("No verifications yet")).toBeVisible();
  await expect(
    page.getByText("http://127.0.0.1:8025/providers/twilio"),
  ).toBeVisible();

  await navigateInApp(page, "/logs");
  await expect(page.getByText("No SMTP sessions yet")).toBeVisible();
  await page.getByRole("tab", { name: "API requests" }).click();
  await expect(page.getByText("No API requests yet")).toBeVisible();
  await expect(page.getByText("http://127.0.0.1:8025/api/v1")).toBeVisible();
});

test("UI-04.2 sample buttons create items the screens can be explored with", async ({
  page,
}) => {
  await page.goto("/mail");
  await switchToEmptyDataSet(page);

  await page.getByRole("button", { name: "Send a sample email" }).click();
  await expect(page.getByText("Your verification code").first()).toBeVisible();
  await navigateInApp(page, "/logs");
  await expect(
    page.getByRole("row").filter({ hasText: "laravel.local" }),
  ).toBeVisible();

  await navigateInApp(page, "/sms");
  await page.getByRole("button", { name: "Send a sample SMS" }).click();
  await expect(page.getByRole("link", { name: /\+14155550100/ })).toBeVisible();

  await navigateInApp(page, "/sms/verify");
  await page
    .getByRole("button", { name: "Start a sample verification" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "+14155550100" }),
  ).toContainText("Pending");

  await navigateInApp(page, "/numbers");
  const deleteNumberButtons = page.getByRole("button", { name: /^Delete \+/ });
  // The empty data set keeps configuration, so remove the seeded numbers first.
  await expect(deleteNumberButtons.first()).toBeVisible();
  for (
    let remainingCount = await deleteNumberButtons.count();
    remainingCount > 0;
    remainingCount -= 1
  ) {
    await deleteNumberButtons.first().click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(deleteNumberButtons).toHaveCount(remainingCount - 1);
  }
  await page.getByRole("button", { name: "Add a sample number" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Sample number" }),
  ).toBeVisible();
});

test("UI-04.3 the app location choice is shared, remembered and changes every host", async ({
  page,
}) => {
  await page.goto("/mail");
  await switchToEmptyDataSet(page);

  await page.getByRole("radio", { name: "Compose" }).click();
  await expect(
    page.locator("dd").filter({ hasText: /^sendmock$/ }),
  ).toBeVisible();
  await navigateInApp(page, "/sms");
  await expect(page.getByText("http://sendmock:8025/api/v1/sms")).toBeVisible();

  await navigateInApp(page, "/settings?section=connection");
  await expect(
    page.getByRole("combobox", { name: "Where does your app run?" }),
  ).toHaveText("In the same Docker Compose project");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Where does your app run?" }),
  ).toHaveText("In the same Docker Compose project");
});

test("UI-04.3 a Docker install defaults to the Compose host", async ({
  page,
}) => {
  await page.goto("/");
  const connectCard = page.locator("[data-slot='card']").filter({
    hasText: "Connect your app",
  });
  await expect(connectCard).toContainText("127.0.0.1:1025");

  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByLabel("Running in Docker").click();
  await page.keyboard.press("Escape");

  await expect(connectCard).toContainText("sendmock:1025");
  await expect(connectCard).toContainText("http://sendmock:8025/api/v1");
});

test("UI-04.4 a filter that matches nothing offers Clear filter instead of onboarding", async ({
  page,
}) => {
  await page.goto("/mail");
  await page.getByLabel("Search emails").fill("nothing-matches-this-search");

  await expect(page.getByText("No emails match this search.")).toBeVisible();
  await expect(page.getByText("Where does your app run?")).toBeHidden();
  await page
    .getByRole("button", { name: "Clear search" })
    .filter({ hasText: "Clear search" })
    .click();
  await expect(page.getByText("No emails match this search.")).toBeHidden();

  await navigateInApp(page, "/sms/verify");
  await page.getByLabel("Search verifications").fill("+10000000000");
  await expect(
    page.getByText("No verifications match this status or search."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
});
