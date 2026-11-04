import { expect, test, type APIRequestContext } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

/** Nothing listens on port 9, so deliveries fail fast without leaving the machine. */
const unreachableUrl = "http://127.0.0.1:9/hooks";

const liveSeed = `[[webhook.templates]]
id = "custom.live_orders"
name = "Live orders"
events = ["email.received"]

[webhook.templates.request]
method = "POST"
content_type = "application/json"
body = '{"subject": "{{ data.subject }}"}'

[[webhook.endpoints]]
name = "Live inbound"
url = "${unreachableUrl}"
template = "custom.live_orders"

[[webhook.variables]]
name = "live_tenant"
kind = "text"
value = "acme"

[[webhook.rules]]
name = "Live inbound rule"
endpoint = "Live inbound"
events = ["email.received"]

[[webhook.saved]]
name = "Live saved"
endpoint = "Live inbound"
url = "${unreachableUrl}"
body = "{}"
`;

/** Applies the same seed every time; applying is idempotent, so tests can run alone. */
async function applyLiveSeed(request: APIRequestContext) {
  const applyResponse = await request.post("/api/v1/seed/apply", {
    data: { seed_toml: liveSeed },
  });
  expect(applyResponse.status()).toBe(200);
}

async function sendTestDelivery(request: APIRequestContext) {
  const endpoints = (await (
    await request.get("/api/v1/webhooks/endpoints")
  ).json()) as { id: string; name: string }[];
  const liveEndpoint = endpoints.find(
    (endpoint) => endpoint.name === "Live inbound",
  );
  expect(liveEndpoint).toBeDefined();
  const testResponse = await request.post(
    `/api/v1/webhooks/endpoints/${liveEndpoint?.id ?? ""}/test`,
  );
  expect(testResponse.ok()).toBe(true);
}

const screensWithSeededItems = [
  { path: "/webhooks/endpoints", seededText: "Live inbound" },
  { path: "/webhooks/rules", seededText: "Live inbound rule" },
  { path: "/webhooks/templates", seededText: "Live orders" },
  { path: "/webhooks/variables", seededText: "live_tenant" },
  { path: "/webhooks/saved", seededText: "Live saved" },
  { path: "/webhooks/deliveries", seededText: "Live inbound" },
];

for (const { path, seededText } of screensWithSeededItems) {
  test(`UI-12.2 ${path} shows the seeded webhooks live without failing calls`, async ({
    page,
    request,
  }) => {
    await applyLiveSeed(request);
    await sendTestDelivery(request);
    const failedApiCalls = watchFailedApiCalls(page);

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(seededText).first()).toBeVisible();
    await expect(page.getByText("Not available yet")).toHaveCount(0);
    expect(failedApiCalls).toEqual([]);
  });
}

for (const path of ["/webhooks/overview", "/webhooks/composer", "/"]) {
  test(`UI-12.2 ${path} works on the live binary without failing calls`, async ({
    page,
    request,
  }) => {
    await applyLiveSeed(request);
    await sendTestDelivery(request);
    const failedApiCalls = watchFailedApiCalls(page);

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Not available yet")).toHaveCount(0);
    expect(failedApiCalls).toEqual([]);
  });
}

test("PL-04.6 Settings > Seed shows the applied seed, exports it, and validates then applies a pasted file", async ({
  page,
  request,
}) => {
  await applyLiveSeed(request);
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/settings?section=seed");
  await expect(page.getByText(/applied /)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export sendmock.seed.toml" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "sendmock.seed.toml",
  );

  const seedField = page.getByLabel("Seed file (TOML)");
  await seedField.fill('[[numbers]]\nnumber = "+15550007777"\nlabel = "Sales"');
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("list", { name: "Seed summary" })).toContainText(
    "Virtual number",
  );
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Apply" })
    .click();
  await expect(page.getByText("Seed file applied")).toBeVisible();

  const numbers = (await (await request.get("/api/v1/numbers")).json()) as {
    number: string;
    created_by: string;
  }[];
  expect(numbers).toContainEqual(
    expect.objectContaining({ number: "+15550007777", created_by: "seed" }),
  );
  expect(failedApiCalls).toEqual([]);
});
