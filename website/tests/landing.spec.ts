import { expect, type Page, test } from "@playwright/test";

import { countSpecOperations } from "./support/count-spec-operations";

/** Scrolls the whole page so every in-view animation gets its chance to run. */
async function scrollThroughPage(page: Page) {
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let scrollTop = 0; scrollTop < pageHeight; scrollTop += 500) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
  }
}

test("WS-02.1 the landing page has the hero, flow, quick start, marquee, bento grid and number ticker", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Catch every email, SMS, payment and webhook",
  );
  await expect(
    page.getByRole("link", { name: "Try the live demo" }).first(),
  ).toBeVisible();
  const flowDiagram = page.getByTestId("flow-diagram");
  await expect(flowDiagram).toContainText("SendMock");
  await expect(flowDiagram.locator("svg path").first()).toBeAttached();
  await expect(page.getByTestId("works-with-marquee")).toContainText("Twilio");
  await expect(page.getByTestId("quick-start-terminal")).toBeVisible();
  await expect(page.getByTestId("features-bento")).toContainText("Payments");
  await expect(page.getByTestId("number-ticker")).toHaveCount(3);
  await expect(
    page.getByRole("tablist", { name: "Product screens" }).getByRole("tab"),
  ).toHaveCount(4);
});

test("WS-02.1 the stack marquee fades out at both edges", async ({ page }) => {
  await page.goto("/");
  const maskImage = await page
    .getByTestId("works-with-marquee")
    .evaluate((marqueeElement) => getComputedStyle(marqueeElement).maskImage);
  // Chrome reports `transparent` as rgba(0, 0, 0, 0).
  const clear = "(?:transparent|rgba\\(0, 0, 0, 0\\))";

  expect(maskImage).toMatch(
    new RegExp(`^linear-gradient\\(to right, ${clear}, .+, ${clear}\\)$`),
  );
});

test("WS-02.1 the number ticker counts the providers, languages and API operations it shows", async ({
  page,
}) => {
  await page.goto("/");
  await scrollThroughPage(page);

  await expect(page.getByTestId("number-ticker")).toHaveText([
    "15",
    "8",
    String(countSpecOperations()),
  ]);
});

test("WS-02.1 the product screens switch with the tabs and the arrow keys", async ({
  page,
}) => {
  await page.goto("/");
  const screenTabs = page.getByRole("tablist", { name: "Product screens" });
  const screenPanel = page.getByRole("tabpanel");

  await screenTabs.getByRole("tab", { name: "SMS" }).click();
  await expect(screenPanel.getByRole("img").first()).toHaveAttribute(
    "alt",
    /The SMS screen/,
  );
  await page.keyboard.press("ArrowRight");
  await expect(screenTabs.getByRole("tab", { name: "Webhooks" })).toBeFocused();
  await expect(
    screenTabs.getByRole("tab", { name: "Webhooks" }),
  ).toHaveAttribute("aria-selected", "true");
});

test("WS-02.2 with reduced motion every animation is static and the page stays readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // The quick start shows every line at once instead of typing it.
  const terminal = page.getByTestId("quick-start-terminal");
  await expect(terminal).toContainText(
    "$ sendmock otp --to +8801700000000 --wait 10s",
  );
  await expect(terminal).toContainText("482913");
  // The tickers show their final values without counting.
  await expect(page.getByTestId("number-ticker")).toHaveText([
    "15",
    "8",
    String(countSpecOperations()),
  ]);
  // The beams are drawn as plain paths, with no moving gradient.
  await expect(
    page.getByTestId("flow-diagram").locator("path[stroke^='url(']"),
  ).toHaveCount(0);
  // CSS animations (marquee, shimmer, shiny text) finish at once.
  const runningAnimationCount = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return (
          animation.playState === "running" &&
          (timing?.duration ?? 0) !== 0 &&
          Number(timing?.duration) > 1
        );
      }).length,
  );
  expect(runningAnimationCount).toBe(0);
});

test("the footer and header link to docs, feedback forms, security and the repository", async ({
  page,
}) => {
  await page.goto("/");
  const footerNav = page.getByRole("navigation", { name: "Footer" });

  await expect(
    footerNav.getByRole("link", { name: "Report an issue" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/shibbirweb/sendmock/issues/new?template=bug_report.yml",
  );
  await expect(
    footerNav.getByRole("link", { name: "Report a security issue" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/shibbirweb/sendmock/security/advisories/new",
  );
  await expect(
    footerNav.getByRole("link", { name: "Star on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/shibbirweb/sendmock");
  await expect(
    page.getByRole("link", { name: /SendMock on GitHub/ }).first(),
  ).toBeVisible();
});
