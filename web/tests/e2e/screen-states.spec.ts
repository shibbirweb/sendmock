import { expect, type Page, test } from "@playwright/test";

/** Every screen of the app with its browser tab title (UI-07.4). */
const screens = [
  { path: "/", title: "Overview · SendMock" },
  { path: "/mail", title: "Mail · SendMock" },
  { path: "/sms", title: "SMS · SendMock" },
  { path: "/sms/verify", title: "Verify · SendMock" },
  { path: "/http", title: "HTTP catcher · SendMock" },
  { path: "/webhooks/overview", title: "Overview · Webhooks · SendMock" },
  { path: "/webhooks/endpoints", title: "Endpoints · Webhooks · SendMock" },
  { path: "/webhooks/rules", title: "Rules · Webhooks · SendMock" },
  {
    path: "/webhooks/inbound-routes",
    title: "Inbound routes · Webhooks · SendMock",
  },
  { path: "/webhooks/deliveries", title: "Deliveries · Webhooks · SendMock" },
  { path: "/webhooks/composer", title: "Composer · Webhooks · SendMock" },
  { path: "/webhooks/templates", title: "Templates · Webhooks · SendMock" },
  { path: "/webhooks/variables", title: "Variables · Webhooks · SendMock" },
  { path: "/webhooks/saved", title: "Saved deliveries · Webhooks · SendMock" },
  { path: "/payments", title: "Payments · SendMock" },
  { path: "/payments/gateways", title: "Gateways · Payments · SendMock" },
  { path: "/payments/methods", title: "Methods · Payments · SendMock" },
  { path: "/payments/flows", title: "Flows · Payments · SendMock" },
  { path: "/numbers", title: "Numbers · SendMock" },
  { path: "/logs", title: "Logs · SendMock" },
  { path: "/settings", title: "General · Settings · SendMock" },
];

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

async function chooseApiResponses(page: Page, optionName: string) {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: optionName }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

const screenContent = (page: Page) => page.locator("main").first();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Activity, last 24 hours")).toBeVisible();
});

test("UI-07.4 every screen sets its own tab title, the open item first", async ({
  page,
}) => {
  for (const screen of screens) {
    await navigateInApp(page, screen.path);
    await expect(page).toHaveTitle(screen.title);
  }

  await navigateInApp(page, "/settings?section=payments");
  await expect(page).toHaveTitle("Payments · Settings · SendMock");
  await navigateInApp(page, "/mail");
  await page
    .locator("section[aria-label='Email list']")
    .getByText("Reset your password", { exact: true })
    .click();
  await expect(page).toHaveTitle("Reset your password · Mail · SendMock");
  await navigateInApp(page, "/sms");
  await page.getByText("+8801722222222", { exact: true }).click();
  await expect(page).toHaveTitle("+8801722222222 · SMS · SendMock");
});

test("UI-07.2 every screen shows an error with Try again when the API fails, and recovers", async ({
  page,
}) => {
  await chooseApiResponses(page, "Always 500 server error");
  for (const screen of screens) {
    await navigateInApp(page, screen.path);
    await expect(
      screenContent(page).getByRole("alert").first(),
      `${screen.path} shows an error`,
    ).toContainText("Could not load");
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  }

  // Back to normal, the screen loads again (the demo controls refetch).
  await chooseApiResponses(page, "Normal");
  await expect(screenContent(page).getByRole("alert")).toHaveCount(0);
  await expect(
    screenContent(page).getByRole("heading", {
      name: "Settings",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
});

test("UI-07.2 every screen shows a skeleton while its data loads", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("slider", { name: "Latency" }).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  // The overview and the SMS threads (the sidebar badge) are already loaded.
  const unloadedScreens = screens.filter(
    (screen) => screen.path !== "/" && screen.path !== "/sms",
  );
  for (const screen of unloadedScreens) {
    await navigateInApp(page, screen.path);
    await expect(
      screenContent(page).locator('[data-slot="skeleton"]').first(),
      `${screen.path} shows a skeleton`,
    ).toBeVisible();
  }
});

test("UI-07.2 traffic screens show an empty state with the empty data set", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Empty (no traffic)" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  const emptyTexts: [string, string][] = [
    ["/sms/verify", "No verifications yet"],
    ["/webhooks/overview", "No deliveries yet"],
    ["/webhooks/deliveries", "No deliveries yet"],
    ["/payments", "No payments yet"],
    ["/logs", "No SMTP sessions yet"],
  ];
  for (const [screenPath, emptyText] of emptyTexts) {
    await navigateInApp(page, screenPath);
    await expect(screenContent(page).getByText(emptyText)).toBeVisible();
  }
});
