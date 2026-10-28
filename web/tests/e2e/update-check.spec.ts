import { expect, type Page, test } from "@playwright/test";

/** Picks a pretend install in the demo controls; a reload resets it. */
async function chooseInstall(page: Page, installLabel: string) {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("combobox", { name: "Installed as" }).click();
  await page.getByRole("option", { name: installLabel, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await page.keyboard.press("Escape");
}

async function saveUpdateCheckMode(page: Page, modeLabel: string) {
  const updatesForm = page.getByRole("form", { name: "Updates" });
  await updatesForm
    .getByRole("radio", { name: new RegExp(`^${modeLabel}`) })
    .check();
  await updatesForm.getByRole("button", { name: "Save changes" }).click();
  await expect(
    updatesForm.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
}

const checkButton = (page: Page) =>
  page.getByRole("button", { name: "Check for updates" });

const bell = (page: Page) =>
  page.getByRole("button", { name: /^Notifications/ });

test.beforeEach(async ({ page }) => {
  await page.goto("/settings?section=about");
  await expect(page.getByText("0.1.0-beta.2", { exact: true })).toBeVisible();
});

test("PL-05.10 the update check has Off, Manual and Daily modes; Manual checks only on request", async ({
  page,
}) => {
  const updatesForm = page.getByRole("form", { name: "Updates" });
  await expect(updatesForm.getByRole("radio", { name: /^Off/ })).toBeChecked();
  await expect(
    updatesForm.getByRole("radio", { name: /^Manual/ }),
  ).toBeVisible();
  await expect(
    updatesForm.getByRole("radio", { name: /^Daily/ }),
  ).toBeVisible();

  await saveUpdateCheckMode(page, "Manual");
  await expect(page.getByText(/is available$/)).toHaveCount(0);
  await checkButton(page).click();
  await expect(
    page.getByText("SendMock 0.2.0-beta.1 is available"),
  ).toBeVisible();
});

test("PL-05.10 the Daily mode checks without a click", async ({ page }) => {
  await saveUpdateCheckMode(page, "Daily");

  await expect(
    page.getByText("SendMock 0.2.0-beta.1 is available").first(),
  ).toBeVisible();
});

test("PL-05.11 a found version shows its date, release notes and the upgrade command for the install method", async ({
  page,
}) => {
  await saveUpdateCheckMode(page, "Manual");
  await checkButton(page).click();
  await expect(page.getByText(/^Released /)).toBeVisible();
  await expect(
    page.getByText("Update checker with Off, Manual and Daily modes", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("brew upgrade shibbirweb/tap/sendmock-beta"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy the upgrade command" }),
  ).toBeVisible();

  await chooseInstall(page, "Stable, Docker");
  await checkButton(page).click();
  await expect(page.getByText("SendMock 0.1.1 is available")).toBeVisible();
  await expect(
    page.getByText("docker pull ghcr.io/shibbirweb/sendmock:0.1.1"),
  ).toBeVisible();

  await chooseInstall(page, "Stable, install method unknown");
  await checkButton(page).click();
  await expect(
    page.getByText("SendMock does not know how it was installed"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Release page" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/shibbirweb/sendmock/releases/tag/v0.1.1",
  );
});

test("PL-05.11 with Daily a new version raises one header notification", async ({
  page,
}) => {
  await saveUpdateCheckMode(page, "Daily");
  await expect(bell(page)).toHaveAccessibleName(/^Notifications, 1 unread$/);
  await checkButton(page).click();
  await expect(page.getByText(/kept for 24 hours/)).toBeVisible();

  await bell(page).click();
  const notificationList = page.getByRole("list", { name: "Notifications" });
  await expect(
    notificationList.getByRole("listitem").filter({
      hasText: "SendMock 0.2.0-beta.1 is available",
    }),
  ).toHaveCount(1);
  await notificationList.getByRole("link", { name: /0\.2\.0-beta\.1/ }).click();
  await expect(page).toHaveURL(/\/settings\?section=about$/);
});

test("PL-05.12 stable installs are offered stables only and edge builds nothing", async ({
  page,
}) => {
  await saveUpdateCheckMode(page, "Manual");

  await chooseInstall(page, "Stable, install script on Linux");
  await checkButton(page).click();
  await expect(page.getByText("SendMock 0.1.1 is available")).toBeVisible();

  await chooseInstall(page, "Stable, already the newest");
  await checkButton(page).click();
  await expect(
    page.getByText("You are on the latest stable version (0.1.1)."),
  ).toBeVisible();

  await chooseInstall(page, "Edge image from develop");
  await checkButton(page).click();
  await expect(
    page.getByText(/^Edge builds are not offered updates/),
  ).toBeVisible();
});

test("PL-05.12 says it could not check when GitHub cannot be reached", async ({
  page,
}) => {
  await saveUpdateCheckMode(page, "Manual");
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByLabel("GitHub reachable").click();
  await page.keyboard.press("Escape");

  await checkButton(page).click();
  await expect(
    page.getByRole("form", { name: "Updates" }).getByRole("alert"),
  ).toContainText("Could not check for updates");
});

test("PL-05.13 the upgrade command follows the platform SendMock runs on", async ({
  page,
}) => {
  await saveUpdateCheckMode(page, "Manual");

  await chooseInstall(page, "Beta, install script on Windows");
  await checkButton(page).click();
  await expect(
    page.getByText(
      "& ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1))) -Channel beta",
    ),
  ).toBeVisible();

  await chooseInstall(page, "Stable, Scoop on Windows");
  await checkButton(page).click();
  await expect(page.getByText("scoop update sendmock")).toBeVisible();
});
