/**
 * Captures the landing page screenshots from the mock-mode web app, so they
 * always show the current UI. Start the app first (`bun run dev` in web/),
 * then run `bun run screenshots` here; pass another base URL as the argument.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Page } from "@playwright/test";

const appBaseUrl = process.argv[2] ?? "http://localhost:5173";
const outputDirectory = fileURLToPath(
  new URL("../public/screenshots", import.meta.url),
);
/** The docs show the light shots next to their Markdown (docs/wiki/images). */
const docsImageDirectory = fileURLToPath(
  new URL("../../docs/wiki/images", import.meta.url),
);

type Scene = { name: string; open: (page: Page) => Promise<void> };

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

const scenes: Scene[] = [
  {
    name: "mail",
    open: async (page) => {
      await navigateInApp(page, "/mail");
      await page.getByText("Welcome to Acme", { exact: false }).first().click();
      await page.getByRole("tab", { name: "HTML" }).waitFor();
    },
  },
  {
    name: "sms",
    open: async (page) => {
      await navigateInApp(page, "/sms");
      await page.getByText("+8801722222222", { exact: true }).click();
      await page.getByTestId("reply-webhook-result").first().waitFor();
    },
  },
  {
    name: "webhooks",
    open: async (page) => {
      await navigateInApp(page, "/webhooks/overview");
      await page.getByText("Deliveries over time").waitFor();
    },
  },
  {
    name: "checkout",
    open: async (page) => {
      await navigateInApp(page, "/payments");
      const paymentHref = await page
        .getByTestId("payment-row")
        .filter({ hasText: "Nadia Islam" })
        .getByRole("link")
        .getAttribute("href");
      const paymentId = new URL(paymentHref ?? "", appBaseUrl).searchParams.get(
        "payment",
      );
      await navigateInApp(page, `/pay/${paymentId}`);
      await page.getByRole("note", { name: "Test mode" }).waitFor();
    },
  },
];

mkdirSync(outputDirectory, { recursive: true });
mkdirSync(docsImageDirectory, { recursive: true });
const browser = await chromium.launch();
for (const colorScheme of ["light", "dark"] as const) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    colorScheme,
    reducedMotion: "reduce",
  });
  await page.goto(appBaseUrl);
  await page.getByText("Activity, last 24 hours").waitFor();
  for (const scene of scenes) {
    await scene.open(page);
    // Live demo traffic raises toasts; they are not part of the product shot.
    await page.evaluate(() => {
      document
        .querySelectorAll("[data-sonner-toaster]")
        .forEach((toaster) => toaster.remove());
    });
    await page.waitForTimeout(500);
    const screenshotPath = join(
      outputDirectory,
      `${scene.name}-${colorScheme}.jpg`,
    );
    await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80 });
    if (colorScheme === "light") {
      copyFileSync(
        screenshotPath,
        join(docsImageDirectory, `${scene.name}.jpg`),
      );
    }
  }
  await page.close();
}
await browser.close();
console.log(`Saved ${scenes.length * 2} screenshots to public/screenshots/.`);
