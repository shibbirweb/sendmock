import { expect, test } from "@playwright/test";

import { buildOperationId } from "../../src/lib/api/endpoint-registry/operation-id";
import { listAllNavigationItems } from "../../src/features/navigation/navigation-items";
import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import { watchFailedApiCalls } from "./live-api-watch";

for (const navigationItem of listAllNavigationItems()) {
  test(`UI-12.2 ${navigationItem.title} (${navigationItem.path}) shows live data or Not available yet, never an error`, async ({
    page,
    request,
  }) => {
    const appInfo = (await (await request.get("/api/v1/info")).json()) as {
      available_operations: string[];
    };
    const [method = "", path = ""] = navigationItem.listOperationKey.split(" ");
    const isServed = appInfo.available_operations.includes(
      buildOperationId(method, path),
    );
    const failedApiCalls = watchFailedApiCalls(page);

    await page.goto(navigationItem.path);
    await page.waitForLoadState("networkidle");

    if (isServed) {
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
