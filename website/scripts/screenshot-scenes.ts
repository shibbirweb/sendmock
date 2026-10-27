/**
 * The screens `capture-screenshots.ts` photographs. Landing scenes are taken
 * in both themes for the website; docs scenes in the light theme only, one per
 * user guide menu page (docs/plan/19-user-guide.md, WS-06.2).
 */
import type { Page } from "@playwright/test";

export type Scene = {
  name: string;
  isLandingShot: boolean;
  open: (page: Page, appBaseUrl: string) => Promise<void>;
};

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

/** A screen that only needs its page loaded, recognised by its tab title. */
function listScene(name: string, path: string, title: string): Scene {
  return {
    name,
    isLandingShot: false,
    open: async (page) => {
      await navigateInApp(page, path);
      // The title may carry an unread count, as in "(3) Mail · SendMock".
      await page.waitForFunction(
        (expectedTitle) => document.title.endsWith(expectedTitle),
        title,
        { timeout: 10_000 },
      );
    },
  };
}

async function readPaymentId(
  page: Page,
  appBaseUrl: string,
  customerName: string,
) {
  const paymentHref = await page
    .getByTestId("payment-row")
    .filter({ hasText: customerName })
    .getByRole("link")
    .getAttribute("href");

  return new URL(paymentHref ?? "", appBaseUrl).searchParams.get("payment");
}

const landingScenes: Scene[] = [
  {
    name: "mail",
    isLandingShot: true,
    open: async (page) => {
      await navigateInApp(page, "/mail");
      await page.getByText("Welcome to Acme", { exact: false }).first().click();
      await page.getByRole("tab", { name: "HTML" }).waitFor();
    },
  },
  {
    name: "sms",
    isLandingShot: true,
    open: async (page) => {
      await navigateInApp(page, "/sms");
      await page.getByText("+8801722222222", { exact: true }).click();
      await page.getByTestId("reply-webhook-result").first().waitFor();
    },
  },
  {
    name: "webhooks",
    isLandingShot: true,
    open: async (page) => {
      await navigateInApp(page, "/webhooks/overview");
      await page.getByText("Deliveries over time").waitFor();
    },
  },
  {
    name: "checkout",
    isLandingShot: true,
    open: async (page, appBaseUrl) => {
      await navigateInApp(page, "/payments");
      const paymentId = await readPaymentId(page, appBaseUrl, "Nadia Islam");
      await navigateInApp(page, `/pay/${paymentId}`);
      await page.getByRole("note", { name: "Test mode" }).waitFor();
    },
  },
];

const docsScenes: Scene[] = [
  listScene("overview", "/", "Overview · SendMock"),
  listScene("verify", "/sms/verify", "Verify · SendMock"),
  {
    name: "http",
    isLandingShot: false,
    open: async (page) => {
      await navigateInApp(page, "/http");
      await page
        .getByRole("navigation", { name: "Bin list" })
        .getByRole("button", { name: /^slack/ })
        .click();
      await page.getByTestId("captured-request").first().click();
      await page.getByRole("article", { name: "Slack message" }).waitFor();
    },
  },
  listScene(
    "webhook-endpoints",
    "/webhooks/endpoints",
    "Endpoints · Webhooks · SendMock",
  ),
  listScene("webhook-rules", "/webhooks/rules", "Rules · Webhooks · SendMock"),
  listScene(
    "webhook-inbound-routes",
    "/webhooks/inbound-routes",
    "Inbound routes · Webhooks · SendMock",
  ),
  {
    name: "webhook-deliveries",
    isLandingShot: false,
    open: async (page) => {
      await navigateInApp(page, "/webhooks/deliveries");
      await page.getByRole("button", { name: "Failed", exact: true }).click();
      await page.getByRole("row").nth(1).getByRole("link").first().click();
      await page.getByRole("dialog", { name: "Delivery" }).waitFor();
    },
  },
  listScene(
    "webhook-composer",
    "/webhooks/composer",
    "Composer · Webhooks · SendMock",
  ),
  listScene(
    "webhook-templates",
    "/webhooks/templates",
    "Templates · Webhooks · SendMock",
  ),
  listScene(
    "webhook-variables",
    "/webhooks/variables",
    "Variables · Webhooks · SendMock",
  ),
  {
    name: "payments",
    isLandingShot: false,
    open: async (page, appBaseUrl) => {
      await navigateInApp(page, "/payments");
      const paymentId = await readPaymentId(page, appBaseUrl, "Lena Vogel");
      await navigateInApp(page, `/payments?payment=${paymentId}`);
      await page.getByRole("dialog").waitFor();
    },
  },
  listScene("mail-providers", "/mail/providers", "Providers · Mail · SendMock"),
  listScene("sms-providers", "/sms/providers", "Providers · SMS · SendMock"),
  listScene(
    "payment-gateways",
    "/payments/gateways",
    "Gateways · Payments · SendMock",
  ),
  listScene(
    "payment-methods",
    "/payments/methods",
    "Methods · Payments · SendMock",
  ),
  listScene("payment-flows", "/payments/flows", "Flows · Payments · SendMock"),
  listScene("numbers", "/numbers", "Numbers · SendMock"),
  {
    name: "scenarios",
    isLandingShot: false,
    open: async (page) => {
      await navigateInApp(page, "/scenarios");
      await page.getByRole("button", { name: "Run", exact: true }).click();
      await page.getByRole("region", { name: "Run report" }).waitFor();
    },
  },
  {
    name: "logs",
    isLandingShot: false,
    open: async (page) => {
      await navigateInApp(page, "/logs");
      await page.getByRole("link", { name: "worker-3" }).click();
      await page
        .getByRole("dialog", { name: "SMTP session" })
        .getByRole("list", { name: "SMTP transcript" })
        .waitFor();
    },
  },
  listScene("settings", "/settings", "General · Settings · SendMock"),
];

export const scenes: Scene[] = [...landingScenes, ...docsScenes];
