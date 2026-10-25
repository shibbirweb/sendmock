import { expect, test } from "@playwright/test";

const repositoryUrl = "https://github.com/shibbirweb/sendmock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
});

test("UI-10.1 the Help menu links to docs, what's new, feedback forms, security and the repository", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Help" }).click();
  const helpMenu = page.getByRole("menu");

  await expect(
    helpMenu.getByRole("menuitem", { name: "Documentation" }),
  ).toHaveAttribute("href", "https://shibbirweb.github.io/sendmock/docs/");
  await expect(
    helpMenu.getByRole("menuitem", { name: "What's new" }),
  ).toHaveAttribute("href", `${repositoryUrl}/releases`);
  await expect(
    helpMenu.getByRole("menuitem", { name: "Report a security issue" }),
  ).toHaveAttribute("href", `${repositoryUrl}/security/advisories/new`);
  await expect(
    helpMenu.getByRole("menuitem", { name: "Star on GitHub" }),
  ).toHaveAttribute("href", repositoryUrl);
  for (const linkName of [
    "Documentation",
    "Report an issue",
    "Star on GitHub",
  ]) {
    await expect(
      helpMenu.getByRole("menuitem", { name: linkName }),
    ).toHaveAttribute("target", "_blank");
  }

  const bugReportUrl = new URL(
    (await helpMenu
      .getByRole("menuitem", { name: "Report an issue" })
      .getAttribute("href")) ?? "",
  );
  expect(bugReportUrl.pathname).toBe("/shibbirweb/sendmock/issues/new");
  expect(bugReportUrl.searchParams.get("template")).toBe("bug_report.yml");
  expect(bugReportUrl.searchParams.get("version")).toMatch(/\d+\.\d+\.\d+/);
  expect(bugReportUrl.searchParams.get("channel")).not.toBeNull();
  expect(bugReportUrl.searchParams.get("os")).not.toBeNull();
  expect(bugReportUrl.searchParams.get("browser")).toMatch(/Chrome/);
  // Only the environment is shared, never captured data.
  expect([...bugReportUrl.searchParams.keys()].sort()).toEqual([
    "browser",
    "channel",
    "os",
    "template",
    "version",
  ]);
  await expect(
    helpMenu.getByRole("menuitem", { name: "Request a feature" }),
  ).toHaveAttribute("href", /template=feature_request\.yml/);
});

test("UI-10.1 Keyboard shortcuts in the Help menu opens the shortcut list", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();

  await expect(
    page.getByRole("dialog", { name: /Keyboard shortcuts/ }),
  ).toBeVisible();
});

test("UI-10.1 Settings > About has the same help and feedback links", async ({
  page,
}) => {
  await page.goto("/settings?section=about");
  const helpCard = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Help and feedback" }),
  });

  await expect(
    page.getByRole("link", { name: "Report an issue" }),
  ).toHaveAttribute("href", /template=bug_report\.yml/);
  await expect(
    page.getByRole("link", { name: "Star on GitHub" }),
  ).toHaveAttribute("href", repositoryUrl);
  await expect(
    helpCard.getByRole("button", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
});
