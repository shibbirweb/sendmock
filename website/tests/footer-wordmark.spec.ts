import { expect, type Locator, type Page, test } from "@playwright/test";

import { mockDownloadRegistries } from "./support/download-registries";

/** The test build reads tests/fixtures/download-activity-sources.json (playwright.config.ts). */
const buildDays = [
  { date: "2026-01-01", downloads: 10, level: 1 },
  { date: "2026-01-02", downloads: 0, level: 0 },
  { date: "2026-01-03", downloads: 42, level: 4 },
  { date: "2026-01-04", downloads: 20, level: 2 },
  { date: "2026-01-05", downloads: 5, level: 1 },
  { date: "2026-01-06", downloads: 30, level: 3 },
  { date: "2026-01-07", downloads: 12, level: 2 },
];

/**
 * A page with the footer and no motion components. The landing page's flow beams repeat
 * forever, so they request animation frames of their own, and its motion components can
 * re-render the page under reduced motion while a test reaches for the footer.
 */
const quietPagePath = "/changelog";

async function openFooterWordmark(page: Page, pagePath = "/") {
  await page.goto(pagePath);
  const wordmark = page.locator("[data-footer-wordmark]");
  await wordmark.scrollIntoViewIfNeeded();
  const canvas = wordmark.locator("canvas");
  return { wordmark, canvas };
}

async function readShownDays(canvas: Locator) {
  const describedDays = await canvas.getAttribute("data-download-days");
  return JSON.parse(describedDays ?? "[]") as typeof buildDays;
}

async function readSpotlight(wordmark: Locator) {
  return wordmark.evaluate((wordmarkElement: HTMLElement) => ({
    opacity: Number(
      wordmarkElement.style.getPropertyValue("--spotlight-opacity") || "0",
    ),
    pointerX: parseFloat(
      wordmarkElement.style.getPropertyValue("--pointer-x") || "0",
    ),
  }));
}

async function findWordmarkBox(wordmark: Locator) {
  const wordmarkBox = await wordmark.boundingBox();
  if (!wordmarkBox) {
    throw new Error("The footer wordmark has no box.");
  }
  return wordmarkBox;
}

test("WS-15.1 WS-15.2 the footer spells SendMock in squares showing the build's 7 days of downloads", async ({
  page,
}) => {
  await mockDownloadRegistries(page, { isFailing: true });
  const { wordmark, canvas } = await openFooterWordmark(page);

  await expect
    .poll(async () => Number(await canvas.getAttribute("data-square-count")))
    .toBeGreaterThan(1000);
  await expect.poll(() => readShownDays(canvas)).toEqual(buildDays);
  expect(
    await canvas.evaluate((element: HTMLCanvasElement) => element.width),
  ).toBeGreaterThan(0);
});

test.describe("before the page's script runs", () => {
  test.use({ javaScriptEnabled: false });

  test("WS-15.1 the word already shows as empty-day squares, so the first paint is never blank", async ({
    page,
  }) => {
    await page.goto("/");
    const placeholder = page.locator("[data-footer-wordmark] svg");

    await expect(placeholder).toBeVisible();
    await expect(placeholder.locator("path")).toHaveAttribute(
      "fill",
      /^url\(#wordmark-squares-/,
    );
    await expect(placeholder.locator("pattern rect")).toHaveCount(1);
  });
});

test("WS-15.3 the browser refreshes npm and crates.io, keeps them 4 hours, and PyPI keeps its build days", async ({
  page,
}) => {
  const registries = await mockDownloadRegistries(page);
  const { canvas } = await openFooterWordmark(page);

  await expect
    .poll(async () => (await readShownDays(canvas)).at(-1))
    .toEqual({ date: registries.yesterday, downloads: 120, level: 4 });
  const shownDays = await readShownDays(canvas);
  expect(shownDays.at(-2)).toEqual({
    date: registries.dayBeforeYesterday,
    downloads: 50,
    level: 2,
  });
  expect(registries.requestedHosts().sort()).toEqual([
    "api.npmjs.org",
    "crates.io",
  ]);

  // A second visit within 4 hours uses the cached numbers and asks no registry.
  const secondVisit = await mockDownloadRegistries(page, { isFailing: true });
  await page.reload();
  await page.locator("[data-footer-wordmark]").scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await readShownDays(canvas)).at(-1)?.downloads)
    .toBe(120);
  expect(secondVisit.requestedHosts()).toEqual([]);
});

test("WS-15.3 a failed live request keeps the build's numbers and shows no error", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (pageError) => pageErrors.push(pageError.message));
  const registries = await mockDownloadRegistries(page, { isFailing: true });
  const { canvas } = await openFooterWordmark(page);

  await expect.poll(() => registries.requestedHosts().length).toBe(2);
  await page.waitForTimeout(300);

  expect(await readShownDays(canvas)).toEqual(buildDays);
  expect(pageErrors).toEqual([]);
});

test("WS-15.4 the spotlight wakes near the letters, follows the pointer and fades out where it left", async ({
  page,
}) => {
  await mockDownloadRegistries(page, { isFailing: true });
  const { wordmark, canvas } = await openFooterWordmark(page);
  const wordmarkBox = await findWordmarkBox(wordmark);
  const middleY = wordmarkBox.y + wordmarkBox.height / 2;

  await page.mouse.move(
    wordmarkBox.x + wordmarkBox.width / 2,
    wordmarkBox.y - 40,
  );
  await expect
    .poll(async () => (await readSpotlight(wordmark)).opacity)
    .toBeGreaterThan(0);
  expect((await readSpotlight(wordmark)).opacity).toBeLessThan(0.85);

  const lastPointerX = wordmarkBox.width * 0.3;
  await page.mouse.move(wordmarkBox.x + lastPointerX, middleY, { steps: 5 });
  await expect
    .poll(async () => (await readSpotlight(wordmark)).opacity)
    .toBeGreaterThan(0.85);
  await expect
    .poll(async () => (await readSpotlight(wordmark)).pointerX)
    .toBeCloseTo(lastPointerX, 0);
  await expect(canvas).toHaveAttribute("data-breathing", "true");

  await page.mouse.move(5, 5);
  await expect
    .poll(async () => (await readSpotlight(wordmark)).opacity)
    .toBe(0);
  expect((await readSpotlight(wordmark)).pointerX).toBeCloseTo(lastPointerX, 0);
  await expect(canvas).toHaveAttribute("data-breathing", "false");
});

test("WS-15.5 no animation frame runs once the spotlight has settled", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    const counter = window as unknown as { animationFrameCount: number };
    counter.animationFrameCount = 0;
    window.requestAnimationFrame = (frameCallback) => {
      counter.animationFrameCount += 1;
      return requestFrame(frameCallback);
    };
  });
  await mockDownloadRegistries(page, { isFailing: true });
  const { wordmark, canvas } = await openFooterWordmark(page, quietPagePath);
  const wordmarkBox = await findWordmarkBox(wordmark);

  await page.mouse.move(
    wordmarkBox.x + wordmarkBox.width / 2,
    wordmarkBox.y + wordmarkBox.height / 2,
  );
  await expect(canvas).toHaveAttribute("data-breathing", "true");
  await page.mouse.move(5, 5);
  await expect(canvas).toHaveAttribute("data-breathing", "false");
  await expect
    .poll(async () => (await readSpotlight(wordmark)).opacity)
    .toBe(0);
  const readFrameCount = () =>
    page.evaluate(
      () =>
        (window as unknown as { animationFrameCount: number })
          .animationFrameCount,
    );
  const settledFrameCount = await readFrameCount();
  await page.waitForTimeout(600);

  expect(await readFrameCount()).toBe(settledFrameCount);
});

test("WS-15.5 with reduced motion the spotlight moves without easing and the squares do not breathe", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockDownloadRegistries(page, { isFailing: true });
  const { wordmark, canvas } = await openFooterWordmark(page, quietPagePath);
  const wordmarkBox = await findWordmarkBox(wordmark);
  const middleY = wordmarkBox.y + wordmarkBox.height / 2;
  await page.mouse.move(wordmarkBox.x + 20, middleY);
  await expect
    .poll(async () => (await readSpotlight(wordmark)).opacity)
    .toBeGreaterThan(0.5);

  const targetPointerX = wordmarkBox.width * 0.8;
  await page.mouse.move(wordmarkBox.x + targetPointerX, middleY);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

  expect((await readSpotlight(wordmark)).pointerX).toBeCloseTo(
    targetPointerX,
    0,
  );
  await page.waitForTimeout(500);
  expect(await canvas.getAttribute("data-breathing")).not.toBe("true");
});

test.describe("on a touch screen", () => {
  // A phone's touch options; the whole device entry would also switch the browser type,
  // which a describe group cannot do.
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 412, height: 915 },
  });

  test("WS-15.5 a touch screen attaches no pointer listener, so the spotlight never lights", async ({
    page,
  }) => {
    await mockDownloadRegistries(page, { isFailing: true });
    const { wordmark } = await openFooterWordmark(page);
    const wordmarkBox = await findWordmarkBox(wordmark);

    await page.touchscreen.tap(
      wordmarkBox.x + wordmarkBox.width / 2,
      wordmarkBox.y + wordmarkBox.height / 2,
    );
    await page.waitForTimeout(300);

    expect(
      await wordmark.evaluate((wordmarkElement: HTMLElement) =>
        wordmarkElement.style.getPropertyValue("--spotlight-opacity"),
      ),
    ).toBe("");
  });
});

test("WS-15.6 the wordmark is hidden from assistive technology, follows the theme and fades at its foot", async ({
  page,
}) => {
  await mockDownloadRegistries(page, { isFailing: true });
  const { wordmark, canvas } = await openFooterWordmark(page);
  const readEmptyDayColor = () =>
    canvas.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--download-level-0").trim(),
    );

  await expect(wordmark).toHaveAttribute("aria-hidden", "true");
  expect(
    await wordmark.evaluate((element) => getComputedStyle(element).maskImage),
  ).toContain("linear-gradient");
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  const lightColor = await readEmptyDayColor();
  await page.evaluate(() => document.documentElement.classList.add("dark"));

  expect(await readEmptyDayColor()).not.toBe(lightColor);
});
