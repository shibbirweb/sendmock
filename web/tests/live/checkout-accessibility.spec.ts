import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Serious or critical WCAG A / AA violations, as "rule: element" lines. */
async function findSeriousViolations(page: Page): Promise<string[]> {
  const axeResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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

const checkoutsToScan = [
  { provider: "stripe", currency: "USD" },
  { provider: "paypal", currency: "USD" },
  { provider: "sslcommerz", currency: "BDT" },
];

for (const colorScheme of ["light", "dark"] as const) {
  for (const { provider, currency } of checkoutsToScan) {
    test(`PY-03.4 the live ${provider} checkout page has no serious accessibility problems in ${colorScheme} mode`, async ({
      page,
      request,
    }) => {
      const createResponse = await request.post("/api/v1/payments/checkout", {
        data: { provider, amount_minor: 120_000, currency },
      });
      expect(createResponse.status()).toBe(201);
      const createdCheckout = (await createResponse.json()) as {
        checkout_url: string;
      };
      // Reduced motion settles transitions at once, so nothing is scanned mid-fade.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.addInitScript((themeName) => {
        localStorage.setItem("sendmock.theme", themeName);
      }, colorScheme);

      await page.goto(new URL(createdCheckout.checkout_url).pathname);
      await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
      await expect(
        page.getByText(/test checkout$/, { exact: false }).first(),
      ).toBeVisible();

      // Text colours switch to the theme just after the first paint, so the scan
      // is repeated until the page has settled.
      await expect.poll(() => findSeriousViolations(page)).toEqual([]);
    });
  }
}
