import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import { makeUniqueName, sendEmail } from "./live-webhooks";

const emailList = "section[aria-label='Email list']";

async function listVerifyServiceSids(
  request: APIRequestContext,
): Promise<string[]> {
  const verifyServices = (await (
    await request.get("/api/v1/verify/services")
  ).json()) as { sid: string }[];

  return verifyServices.map((verifyService) => verifyService.sid);
}

let verifyServiceSidsBefore: string[] = [];

test.beforeAll(async ({ request }) => {
  verifyServiceSidsBefore = await listVerifyServiceSids(request);
});

/** Reset deletes every message, log and verification but keeps configuration. */
test.beforeEach(async ({ request }) => {
  const resetResponse = await request.post("/api/v1/reset");
  expect(resetResponse.status()).toBe(204);
});

// A sample verification makes a service when there is none, and later specs expect
// their own service to be the first.
test.afterAll(async ({ request }) => {
  for (const serviceSid of await listVerifyServiceSids(request)) {
    if (!verifyServiceSidsBefore.includes(serviceSid)) {
      await request.delete(`/api/v1/verify/services/${serviceSid}`);
    }
  }
});

/** The ports from `/info`, and the host the UI starts with: the Compose host in a container. */
async function readLiveConnection(request: APIRequestContext) {
  const appInfo = (await (await request.get("/api/v1/info")).json()) as {
    smtp_address: string;
    http_address: string;
    is_container: boolean;
  };

  return {
    defaultHost: appInfo.is_container ? "sendmock" : "127.0.0.1",
    smtpPort: appInfo.smtp_address.split(":").pop() ?? "",
    httpPort: appInfo.http_address.split(":").pop() ?? "",
  };
}

/** Numbers are configuration, so reset keeps them; the empty state needs none. */
async function deleteEveryNumber(request: APIRequestContext) {
  const virtualNumbers = (await (
    await request.get("/api/v1/numbers")
  ).json()) as { id: string }[];
  for (const virtualNumber of virtualNumbers) {
    await request.delete(`/api/v1/numbers/${virtualNumber.id}`);
  }
}

/** Client-side navigation, as a reader moves between screens. */
async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

test("UI-04.1 every empty live list shows how to connect with the binary's host and ports", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  const { defaultHost, smtpPort, httpPort } = await readLiveConnection(request);
  await page.goto("/mail");

  await expect(page.getByText("No emails yet")).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: new RegExp(`^${defaultHost}$`) }),
  ).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: new RegExp(`^${smtpPort}$`) }),
  ).toBeVisible();

  await navigateInApp(page, "/sms");
  await expect(page.getByText("No SMS yet")).toBeVisible();
  await expect(
    page.getByText(`http://${defaultHost}:${httpPort}/api/v1/sms`),
  ).toBeVisible();

  await navigateInApp(page, "/sms/verify");
  await expect(page.getByText("No verifications yet")).toBeVisible();
  await expect(
    page.getByText(`http://${defaultHost}:${httpPort}/providers/twilio`),
  ).toBeVisible();

  await navigateInApp(page, "/logs");
  await expect(page.getByText("No SMTP sessions yet")).toBeVisible();
  await page.getByRole("tab", { name: "API requests" }).click();
  await expect(page.getByText("No API requests yet")).toBeVisible();
  await expect(
    page.getByText(`http://${defaultHost}:${httpPort}/api/v1`),
  ).toBeVisible();
  expect(failedApiCalls).toEqual([]);
});

test("UI-04.2 live sample buttons store items through the binary", async ({
  page,
  request,
}) => {
  await deleteEveryNumber(request);
  await page.goto("/mail");

  await page
    .getByRole("button", {
      name: "Send a sample email",
      exact: true,
    })
    .click();
  await expect(
    page.locator(emailList).getByText("Hello from SendMock").first(),
  ).toBeVisible();
  await navigateInApp(page, "/logs");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.getByText("No SMTP sessions yet")).toBeHidden();

  await navigateInApp(page, "/sms");
  await page
    .getByRole("button", {
      name: "Send a sample SMS",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", { name: /\+8801700000000/ }),
  ).toBeVisible();

  await navigateInApp(page, "/sms/verify");
  await page
    .getByRole("button", {
      name: "Start a sample verification",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "+14155550100" }),
  ).toContainText("Pending");

  await navigateInApp(page, "/numbers");
  await page.getByRole("button", { name: "Add a sample number" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Sample number" }),
  ).toBeVisible();
  const storedNumbers = (await (
    await request.get("/api/v1/numbers")
  ).json()) as unknown[];
  expect(storedNumbers).toHaveLength(1);
});

test("UI-04.3 the live app location starts from where the binary runs, is shared with Settings, remembered and changes every host", async ({
  page,
  request,
}) => {
  const { defaultHost, httpPort } = await readLiveConnection(request);
  await page.goto("/mail");
  await expect(
    page.locator("dd").filter({ hasText: new RegExp(`^${defaultHost}$`) }),
  ).toBeVisible();

  // Neither default, so the change is the reader's own choice.
  await page.getByRole("radio", { name: "Docker host" }).click();
  await expect(
    page.locator("dd").filter({ hasText: /^host\.docker\.internal$/ }),
  ).toBeVisible();
  await navigateInApp(page, "/sms");
  await expect(
    page.getByText(`http://host.docker.internal:${httpPort}/api/v1/sms`),
  ).toBeVisible();

  await navigateInApp(page, "/settings?section=connection");
  const locationChoice = page.getByRole("combobox", {
    name: "Where does your app run?",
  });
  await expect(locationChoice).toHaveText(
    "In a container, SendMock on the host",
  );
  await page.reload();
  await expect(locationChoice).toHaveText(
    "In a container, SendMock on the host",
  );
});

test("UI-04.4 a live search that matches nothing offers Clear filter instead of onboarding", async ({
  page,
  request,
}) => {
  await sendEmail(request, makeUniqueName("Live search target"));
  const sampleResponse = await request.post("/api/v1/samples/verification", {
    data: {},
  });
  expect(sampleResponse.ok()).toBe(true);
  await page.goto("/mail");

  await page.getByLabel("Search emails").fill("nothing-matches-this-search");
  await expect(page.getByText("No emails match this search.")).toBeVisible();
  await expect(page.getByText("Where does your app run?")).toBeHidden();
  await page
    .getByRole("button", { name: "Clear search" })
    .filter({ hasText: "Clear search" })
    .click();
  await expect(page.getByText("No emails match this search.")).toBeHidden();
  await expect(page.locator(emailList).getByRole("link").first()).toBeVisible();

  await navigateInApp(page, "/sms/verify");
  await page.getByLabel("Search verifications").fill("+10000000000");
  await expect(
    page.getByText("No verifications match this status or search."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "+14155550100" }),
  ).toBeVisible();
});
