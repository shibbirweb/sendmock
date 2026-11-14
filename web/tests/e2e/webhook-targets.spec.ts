import { expect, type Page, test } from "@playwright/test";

const emailList = "section[aria-label='Email list']";
const threadList = "section[aria-label='Conversation list']";
// The demo email "Your verification code" was sent by the app, so it can be simulated.
const sentSubject = "Your verification code";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

async function openSentEmail(page: Page) {
  await page.goto("/mail");
  await page.locator(emailList).getByText(sentSubject, { exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: sentSubject }),
  ).toBeVisible();
}

async function openSmsDrawer(page: Page, contactNumber: string) {
  await page.goto("/sms");
  await page.locator(threadList).getByText(contactNumber).click();
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();

  return page.getByRole("dialog", { name: "Message details" });
}

test("WH-13.2 Mail's Simulate menu names each event's webhooks under its label", async ({
  page,
}) => {
  await openSentEmail(page);
  await page.getByRole("button", { name: "Simulate an event" }).click();

  const menu = page.getByRole("menu");
  await expect(
    menu.getByRole("menuitem", { name: /^Open \(email\.opened\)/ }),
  ).toContainText("No webhook");
  await expect(
    menu.getByRole("menuitem", { name: /^Delivered/ }).first(),
  ).toContainText(/No webhook|Webhooks: /);
  await expect(
    menu.getByRole("menuitem", {
      name: "Choose webhooks for Simulate hard bounce",
    }),
  ).toBeVisible();
});

test("WH-13.2 the Reply composer and the SMS drawer show a Webhooks row", async ({
  page,
}) => {
  await openSentEmail(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Reply as recipient" })
      .getByRole("group", { name: "Webhooks" }),
  ).toContainText(/No webhook|Laravel inbound mail/);

  const messageDrawer = await openSmsDrawer(page, "+15005550101");
  await expect(
    messageDrawer.getByRole("group", { name: "Webhooks" }),
  ).toContainText("SMS status callbacks");
});

test("WH-13.3 a webhook name opens its endpoint in a new tab and the drawer stays", async ({
  page,
}) => {
  const messageDrawer = await openSmsDrawer(page, "+15005550101");
  const endpointLink = messageDrawer
    .getByRole("group", { name: "Webhooks" })
    .getByRole("link", { name: "SMS status callbacks" });
  await expect(endpointLink).toHaveAttribute("target", "_blank");
  await expect(endpointLink).toHaveAttribute(
    "href",
    /\/webhooks\/endpoints\?endpoint=/,
  );

  const newTabPromise = page.context().waitForEvent("page");
  await endpointLink.click();
  const endpointTab = await newTabPromise;
  await endpointTab.waitForLoadState();
  expect(endpointTab.url()).toContain("/webhooks/endpoints?endpoint=");
  await expect(messageDrawer).toBeVisible();
  await endpointTab.close();

  // A new tab starts its own mock data, so the sheet is proven in this one.
  const endpointPath = await endpointLink.getAttribute("href");
  await page.keyboard.press("Escape");
  await navigateInApp(page, endpointPath ?? "/webhooks/endpoints");
  await expect(
    page.getByRole("dialog").getByRole("textbox", { name: "Name" }),
  ).toHaveValue("SMS status callbacks");
});

test("WH-13.4 Choose sends one simulation to exactly the chosen endpoints", async ({
  page,
}) => {
  await openSentEmail(page);
  await page.getByRole("button", { name: "Simulate an event" }).click();
  await page
    .getByRole("menuitem", { name: "Choose webhooks for Simulate delivered" })
    .click();

  const picker = page.getByRole("dialog", { name: "Choose webhooks" });
  await picker.getByRole("searchbox", { name: "Search endpoints" }).fill("s");
  await picker
    .getByRole("checkbox", { name: "Send to SMS status callbacks" })
    .check();
  await picker.getByRole("checkbox", { name: "Send to Shop payments" }).check();
  await expect(picker).toContainText("2 chosen");
  await picker.getByRole("button", { name: "Simulate delivered" }).click();
  await expect(page.getByText("Simulated: delivered")).toBeVisible();

  await navigateInApp(page, "/webhooks/deliveries");
  const chosenRows = page.getByRole("row").filter({ hasText: "chosen" });
  await expect(chosenRows).toHaveCount(2);
  await expect(chosenRows.filter({ hasText: "email.delivered" })).toHaveCount(
    2,
  );
  for (const chosenEndpointName of ["Shop payments", "SMS status callbacks"]) {
    await expect(
      chosenRows.filter({ hasText: chosenEndpointName }),
    ).toHaveCount(1);
  }
});

test("WH-13.4 Change in a composer picks the endpoints for that one reply", async ({
  page,
}) => {
  await openSentEmail(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const webhooksRow = page
    .getByRole("region", { name: "Reply as recipient" })
    .getByRole("group", { name: "Webhooks" });
  await webhooksRow.getByRole("button", { name: "Change" }).click();

  const picker = page.getByRole("dialog", { name: "Choose webhooks" });
  for (const checkedBox of await picker
    .getByRole("checkbox", { checked: true })
    .all()) {
    await checkedBox.uncheck();
  }
  await picker
    .getByRole("checkbox", { name: "Send to Team Slack alerts" })
    .check();
  await picker.getByRole("button", { name: "Use these" }).click();

  await expect(webhooksRow).toContainText("Team Slack alerts");
  await expect(webhooksRow).toContainText("(chosen for this action)");
  await expect(page.getByRole("group", { name: "Delivers to" })).toContainText(
    "Chosen Team Slack alerts",
  );
  await webhooksRow.getByRole("button", { name: "Use the rules" }).click();
  await expect(webhooksRow).not.toContainText("(chosen for this action)");
});
