import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { appScreens, navigateInApp } from "../e2e/support/app-screens";
import { makeUniqueName, sendEmail } from "./live-webhooks";

/** Serious or critical WCAG A / AA violations, as "rule: element" lines. */
async function findSeriousViolations(page: Page): Promise<string[]> {
  const axeResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Frames hold the email's own HTML, not app UI, sandboxed without scripts.
    .exclude("iframe")
    .exclude("[data-sonner-toaster]")
    .analyze();

  return axeResults.violations
    .filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    )
    .flatMap((violation) =>
      violation.nodes.map(
        (violationNode) => `${violation.id}: ${violationNode.target.join(" ")}`,
      ),
    );
}

/** Some traffic, so the lists are scanned with rows and not only their empty states. */
async function sendSomeTraffic(request: APIRequestContext) {
  await sendEmail(request, makeUniqueName("Live accessibility email"));
  await request.post("/api/v1/sms", {
    data: {
      from: "+15550001111",
      to: "+15550003333",
      body: "Live accessibility SMS",
    },
  });
  await request.post(`/catch/live-a11y-${Date.now().toString(36)}/check`, {
    data: { event: "scan" },
  });
}

async function openApp(page: Page, colorScheme: "light" | "dark") {
  // Reduced motion settles transitions at once, so nothing is scanned mid-fade.
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate((themeName) => {
    localStorage.setItem("sendmock.theme", themeName);
    // A toast over a screen hides what is under it, so axe would misread contrast.
    localStorage.setItem(
      "sendmock.notification-preferences",
      JSON.stringify({ areToastsShown: false, toastPosition: "bottom-right" }),
    );
  }, colorScheme);
  await page.reload();
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`UI-05.2 UI-05.3 no serious or critical axe issues on any live screen, ${colorScheme} theme`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await sendSomeTraffic(request);
    await openApp(page, colorScheme);

    for (const appScreen of appScreens) {
      await navigateInApp(page, appScreen.path);
      await expect(page).toHaveTitle(appScreen.title);
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
      expect(await findSeriousViolations(page), appScreen.path).toEqual([]);
    }
  });
}
