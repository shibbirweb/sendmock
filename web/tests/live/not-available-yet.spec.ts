import { expect, test } from "@playwright/test";

import { listAllNavigationItems } from "../../src/features/navigation/navigation-items";
import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import { watchFailedApiCalls } from "./live-api-watch";

/** Screens whose list operation the Phase 1 binary serves. */
const liveScreenPaths = ["/mail", "/logs", "/settings"];

for (const navigationItem of listAllNavigationItems()) {
  test(`UI-12.2 ${navigationItem.title} (${navigationItem.path}) shows live data or Not available yet, never an error`, async ({
    page,
  }) => {
    const failedApiCalls = watchFailedApiCalls(page);

    await page.goto(navigationItem.path);
    await page.waitForLoadState("networkidle");

    if (liveScreenPaths.includes(navigationItem.path)) {
      await expect(page.getByText(/arrives in Phase/)).toHaveCount(0);
    } else {
      const phase = surfaceCatalogue[navigationItem.listOperationKey]?.phase;
      await expect(
        page.getByRole("heading", {
          name: `${navigationItem.title} arrives in Phase ${phase}`,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "See the roadmap" }),
      ).toBeVisible();
    }
    expect(failedApiCalls).toEqual([]);
  });
}
