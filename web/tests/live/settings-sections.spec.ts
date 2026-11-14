import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import { createEndpoint, makeUniqueName, pickOption } from "./live-webhooks";

type LiveSettings = Record<string, unknown>;

/** The settings this file changes, put back afterwards so later files start from defaults. */
const changedSettingNames = [
  "max_sms",
  "is_plus_address_tagging_enabled",
  "is_strict_twilio_test_mode",
  "payment_merchant_name",
  "opened_event_mode",
  "chaos_smtp_reject_recipient_pattern",
  "otp_patterns",
  "update_check_mode",
];

async function readSettings(request: APIRequestContext): Promise<LiveSettings> {
  return (await (await request.get("/api/v1/settings")).json()) as LiveSettings;
}

let originalSettings: LiveSettings = {};

test.beforeAll(async ({ request }) => {
  const currentSettings = await readSettings(request);
  originalSettings = Object.fromEntries(
    changedSettingNames.map((settingName) => [
      settingName,
      currentSettings[settingName],
    ]),
  );
});

// Each test puts the settings back, so a later test never runs with strict Twilio test mode left on.
test.afterEach(async ({ request }) => {
  const restoreResponse = await request.patch("/api/v1/settings", {
    data: originalSettings,
  });
  expect(restoreResponse.ok()).toBe(true);
});

/** Opens a section, lets `changeField` edit its form, saves it and waits for the toast. */
async function changeAndSave(
  page: Page,
  sectionId: string,
  formName: string,
  changeField: (settingsForm: Locator) => Promise<void>,
) {
  await page.goto(`/settings?section=${sectionId}`);
  const settingsForm = page.getByRole("form", { name: formName });
  await changeField(settingsForm);
  const savePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/settings") &&
      response.request().method() === "PATCH",
    { timeout: 10_000 },
  );
  await settingsForm.getByRole("button", { name: "Save changes" }).click();
  const saveResponse = await savePromise;
  expect(saveResponse.status(), await saveResponse.text()).toBe(200);
  await expect(page.getByText("Settings saved").first()).toBeVisible();
}

test("PL-05.1 a change in each settings section is returned by GET /settings and applies without a restart", async ({
  page,
  request,
}) => {
  const settingsBefore = await readSettings(request);
  const failedApiCalls = watchFailedApiCalls(page);
  await changeAndSave(page, "general", "Retention", async (settingsForm) => {
    await settingsForm.getByLabel("Keep at most").nth(1).fill("4321");
  });
  await changeAndSave(
    page,
    "email",
    "Receiving and delivery outcomes",
    async (settingsForm) => {
      await settingsForm.getByLabel("Tag by plus address").click();
    },
  );
  await changeAndSave(
    page,
    "sms",
    "Delivery simulation",
    async (settingsForm) => {
      await settingsForm.getByLabel("Strict Twilio test mode").click();
    },
  );
  await changeAndSave(page, "payments", "Checkout", async (settingsForm) => {
    await settingsForm.getByLabel("Merchant name").fill("Live Shop");
  });
  await changeAndSave(
    page,
    "opened-events",
    "Opened events",
    async (settingsForm) => {
      await settingsForm.getByText("Every open", { exact: true }).click();
    },
  );
  await changeAndSave(page, "chaos", "Chaos", async (settingsForm) => {
    await settingsForm
      .getByLabel("Reject recipients matching")
      .fill("nobody@chaos-live.test");
  });
  await changeAndSave(page, "otp", "OTP patterns", async (settingsForm) => {
    const patternCount = await settingsForm
      .getByRole("list", { name: "OTP patterns" })
      .getByRole("listitem")
      .count();
    await settingsForm.getByRole("button", { name: "Add pattern" }).click();
    await settingsForm
      .getByLabel(`Pattern ${patternCount + 1}`, { exact: true })
      .fill("ref ([A-Z]{3}[0-9]{3})");
  });
  await changeAndSave(page, "about", "Updates", async (settingsForm) => {
    await settingsForm.getByRole("radio", { name: /^Manual/ }).check();
  });

  const settingsAfter = await readSettings(request);
  expect(settingsAfter).toMatchObject({
    max_sms: 4321,
    is_plus_address_tagging_enabled:
      !settingsBefore.is_plus_address_tagging_enabled,
    is_strict_twilio_test_mode: !settingsBefore.is_strict_twilio_test_mode,
    payment_merchant_name: "Live Shop",
    opened_event_mode: "every_open",
    chaos_smtp_reject_recipient_pattern: "nobody@chaos-live.test",
    update_check_mode: "manual",
  });
  expect(settingsAfter.otp_patterns).toContain("ref ([A-Z]{3}[0-9]{3})");
  expect(failedApiCalls).toEqual([]);

  const recipient = `${makeUniqueName("otp").replaceAll(" ", "-")}@example.test`;
  const sendResponse = await request.post("/api/v1/send", {
    data: {
      from: "app@shop.test",
      to: [recipient],
      subject: "Sign in",
      text: "Use ref QZX481 to sign in",
    },
  });
  expect(sendResponse.status()).toBe(201);
  const otpResponse = await request.get(
    `/api/v1/otp?to=${encodeURIComponent(recipient)}&channel=email`,
  );
  expect(await otpResponse.text()).toContain("QZX481");
});

test("PL-05.4 Reset to seed and the delete-all buttons ask before acting", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live kept");
  await createEndpoint(request, endpointName, "http://127.0.0.1:9/hooks");
  const smsResponse = await request.post("/api/v1/sms", {
    data: { from: "+15550001111", to: "+14155550199", body: "Delete me" },
  });
  expect(smsResponse.status()).toBe(201);
  await page.goto("/settings?section=general");

  for (const [buttonName, dialogTitle] of [
    ["Delete all emails", "Delete all emails?"],
    ["Delete all SMS", "Delete all SMS?"],
    ["Reset to seed", "Reset to seed?"],
  ]) {
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: dialogTitle });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).toBeHidden();
  }
  const endpoints = (await (
    await request.get("/api/v1/webhooks/endpoints")
  ).json()) as { name: string }[];
  expect(endpoints.map((endpoint) => endpoint.name)).toContain(endpointName);
  const smsBefore = (await (await request.get("/api/v1/sms")).json()) as {
    items: unknown[];
  };
  expect(smsBefore.items.length).toBeGreaterThan(0);

  await page
    .getByRole("button", { name: "Delete all SMS", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete all SMS" })
    .click();
  await expect(page.getByText("All SMS deleted")).toBeVisible();
  const smsAfter = (await (await request.get("/api/v1/sms")).json()) as {
    items: unknown[];
  };
  expect(smsAfter.items).toEqual([]);
});

test("PL-05.5 every language has snippets with the live ports, for each place the app runs", async ({
  page,
  request,
}) => {
  const appInfo = (await (await request.get("/api/v1/info")).json()) as {
    smtp_address: string;
    http_address: string;
  };
  const smtpPort = appInfo.smtp_address.split(":").at(-1) ?? "";
  const httpPort = appInfo.http_address.split(":").at(-1) ?? "";
  await page.goto("/settings?section=connection");
  const smtpSnippet = page.getByRole("region", { name: "SMTP" });
  const smsSnippet = page.getByRole("region", { name: "SMS API" });

  await page.getByRole("combobox", { name: "Language" }).click();
  const languageNames = (await page.getByRole("option").allTextContents()).map(
    (name) => name.trim(),
  );
  await page.keyboard.press("Escape");
  expect(languageNames.length).toBeGreaterThan(5);
  for (const languageName of languageNames) {
    await pickOption(page, "Language", languageName);
    await expect(smtpSnippet).toContainText(smtpPort);
    await expect(smsSnippet).toContainText(`:${httpPort}`);
  }

  await pickOption(page, "Language", "Python");
  for (const [locationName, appHost] of [
    ["On this machine", "127.0.0.1"],
    ["In a container, SendMock on the host", "host.docker.internal"],
    ["In the same Docker Compose project", "sendmock"],
  ]) {
    await pickOption(page, "Where does your app run?", locationName);
    await expect(smtpSnippet).toContainText(
      `smtplib.SMTP("${appHost}", ${smtpPort})`,
    );
    await expect(smsSnippet).toContainText(
      `http://${appHost}:${httpPort}/api/v1/sms`,
    );
  }
});
