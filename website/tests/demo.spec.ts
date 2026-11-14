import { expect, test } from "@playwright/test";

import { readSidebarPaths } from "./support/read-sidebar-paths";

/** Files the page itself loads; API calls are answered by the demo's mock. */
const staticResourceTypes = new Set([
  "document",
  "script",
  "stylesheet",
  "image",
  "font",
]);

test("WS-01.2 /demo/ serves the mock-mode app and every sidebar screen works there", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const sidebarPaths = readSidebarPaths();
  expect(sidebarPaths.length).toBeGreaterThan(15);

  const problems: string[] = [];
  page.on("pageerror", (pageError) => {
    problems.push(`${page.url()} threw ${pageError.message}`);
  });
  page.on("requestfailed", (failedRequest) => {
    // Leaving a screen cancels its open requests; that is not a failure.
    const failureText = failedRequest.failure()?.errorText ?? "";
    if (!failureText.includes("ERR_ABORTED")) {
      problems.push(`${failedRequest.url()} failed: ${failureText}`);
    }
  });
  page.on("response", (response) => {
    const isStaticFile = staticResourceTypes.has(
      response.request().resourceType(),
    );
    if (isStaticFile && response.status() >= 400) {
      problems.push(`${response.url()} answered ${response.status()}`);
    }
  });

  await page.goto("/demo/");
  await expect(page.getByRole("status")).toContainText("demo data");

  for (const sidebarPath of sidebarPaths) {
    // Each screen is opened by its own address, as a shared link would open it.
    const demoPath = sidebarPath === "/" ? "/demo/" : `/demo${sidebarPath}`;
    await page.goto(demoPath);
    const screenHeading = page.getByRole("heading", { level: 1 });
    await expect(screenHeading, demoPath).toBeVisible();
    await expect(screenHeading, demoPath).not.toHaveText("Not found");
    await expect(page.getByText("Something went wrong"), demoPath).toHaveCount(
      0,
    );
    await expect(page.getByText("Not available yet"), demoPath).toHaveCount(0);
  }

  expect(problems).toEqual([]);
});
