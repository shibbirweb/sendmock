import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/** One page of each kind on the site. */
const sitePaths = [
  "/",
  "/docs/",
  "/docs/email/",
  "/api/",
  "/api/email/",
  "/playground/",
];

async function findSeriousViolations(page: Page): Promise<string[]> {
  const axeResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The playground's hidden bridge frame is the demo app, scanned in web/.
    .exclude("iframe")
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

for (const colorScheme of ["light", "dark"] as const) {
  test(`every kind of site page has no serious or critical axe issues, ${colorScheme} theme`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const sitePath of sitePaths) {
      await page.goto(sitePath);
      await page.waitForLoadState("networkidle");
      expect(await findSeriousViolations(page), sitePath).toEqual([]);
    }
  });
}

test("every kind of site page fits a 360 px phone without horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const sitePath of sitePaths) {
    await page.goto(sitePath);
    await page.waitForLoadState("networkidle");
    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll, sitePath).toBe(false);
  }
});
