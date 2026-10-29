import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

/**
 * Captures real SendMock pages for the app tour scene
 * (docs/plan/23-promotional-video.md, Version with an app tour).
 * Run the web app in mock mode first: `bun run dev` in `web/`.
 */
type AppPageCapture = {
  fileName: string;
  route: string;
  /** Opens the first item of a list so the page shows its detail. */
  firstItemListSelector?: string;
};

const webAppUrl = process.env.SENDMOCK_WEB_URL ?? "http://localhost:5173";
const outputDirectory = path.resolve("public/app-pages");
const settleDelayMs = 900;

const appPageCaptures: AppPageCapture[] = [
  { fileName: "overview.png", route: "/" },
  {
    fileName: "mail.png",
    route: "/mail",
    firstItemListSelector: "section[aria-label='Email list']",
  },
  {
    fileName: "sms.png",
    route: "/sms",
    firstItemListSelector: "section[aria-label='Conversation list']",
  },
  { fileName: "webhook-deliveries.png", route: "/webhooks/deliveries" },
  { fileName: "webhook-templates.png", route: "/webhooks/templates" },
  { fileName: "payments.png", route: "/payments" },
  { fileName: "http-catcher.png", route: "/http" },
  { fileName: "scenarios.png", route: "/scenarios" },
];

/** Dark theme, no toasts, and the mock-only demo controls hidden. */
async function prepareAppPage(page: Page) {
  await page.goto(webAppUrl);
  await page.evaluate(() => {
    localStorage.setItem("sendmock.theme", "dark");
    localStorage.setItem(
      "sendmock.notification-preferences",
      JSON.stringify({
        areToastsShown: false,
        toastPosition: "bottom-right",
      }),
    );
  });
}

async function captureAppPage(page: Page, appPageCapture: AppPageCapture) {
  await page.goto(`${webAppUrl}${appPageCapture.route}`);
  await page.waitForLoadState("networkidle");
  if (appPageCapture.firstItemListSelector !== undefined) {
    await page
      .locator(appPageCapture.firstItemListSelector)
      .getByRole("link")
      .first()
      .click();
    await page.waitForLoadState("networkidle");
  }
  await page.addStyleTag({
    content: "[aria-label='Demo controls'] { visibility: hidden; }",
  });
  await page.waitForTimeout(settleDelayMs);
  await page.screenshot({
    path: path.join(outputDirectory, appPageCapture.fileName),
  });
  console.log("captured", appPageCapture.fileName);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "reduce",
});
await prepareAppPage(page);
for (const appPageCapture of appPageCaptures) {
  await captureAppPage(page, appPageCapture);
}
await browser.close();
