/**
 * Captures the landing page and user guide screenshots from the mock-mode web
 * app, so they always show the current UI. Start the app first (`bun run dev`
 * in web/), then run `bun run screenshots` here; pass another base URL as the
 * argument, and scene names after it to take only those, e.g.
 * `bun run screenshots http://localhost:5173 mail-providers sms-providers`.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { scenes } from "./screenshot-scenes";

const appBaseUrl = process.argv[2] ?? "http://localhost:5173";
const onlySceneNames = process.argv.slice(3);
const outputDirectory = fileURLToPath(
  new URL("../public/screenshots", import.meta.url),
);
/** The docs show the light shots next to their Markdown (docs/wiki/images). */
const docsImageDirectory = fileURLToPath(
  new URL("../../docs/wiki/images", import.meta.url),
);

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
  // Live demo traffic raises toasts; they are not part of the product shot.
  // Hidden rather than removed: React still owns the toaster and crashes the
  // page when a removed node gets its next toast.
  await page.addStyleTag({
    content: "[data-sonner-toaster] { display: none !important; }",
  });
  const themeScenes = scenes.filter(
    (scene) =>
      (scene.isLandingShot || colorScheme === "light") &&
      (onlySceneNames.length === 0 || onlySceneNames.includes(scene.name)),
  );
  for (const scene of themeScenes) {
    // A drawer left open by the previous scene would cover the next one.
    await page.keyboard.press("Escape");
    await scene.open(page, appBaseUrl);
    await page.waitForTimeout(1_000);
    const docsImagePath = join(docsImageDirectory, `${scene.name}.jpg`);
    if (!scene.isLandingShot) {
      await page.screenshot({
        path: docsImagePath,
        type: "jpeg",
        quality: 80,
        animations: "disabled",
      });
      continue;
    }
    const screenshotPath = join(
      outputDirectory,
      `${scene.name}-${colorScheme}.jpg`,
    );
    await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80 });
    if (colorScheme === "light") {
      copyFileSync(screenshotPath, docsImagePath);
    }
  }
  await page.close();
}
await browser.close();
console.log(
  "Saved the landing screenshots to public/screenshots/ and the docs shots to docs/wiki/images/.",
);
