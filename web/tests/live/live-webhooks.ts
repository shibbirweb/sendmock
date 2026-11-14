import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

let nameCounter = 0;

/** A name no other test uses, so tests can share one live server. */
export function makeUniqueName(prefix: string): string {
  nameCounter += 1;

  return `${prefix} ${Date.now().toString(36)}${nameCounter}`;
}

export type WebhookReceiver = {
  url: string;
  receivedBodies: string[];
  close: () => Promise<void>;
};

/** An app on a free local port that answers every webhook with `statusCode`. */
export async function startWebhookReceiver(
  statusCode = 200,
  responseBody = "ok",
): Promise<WebhookReceiver> {
  const receivedBodies: string[] = [];
  const receiverServer = createServer((appRequest, appResponse) => {
    let requestBody = "";
    appRequest.on("data", (bodyChunk: Buffer) => {
      requestBody += bodyChunk.toString();
    });
    appRequest.on("end", () => {
      receivedBodies.push(requestBody);
      appResponse.writeHead(statusCode, { "Content-Type": "text/plain" });
      appResponse.end(responseBody);
    });
  });
  await new Promise<void>((resolve) => {
    receiverServer.listen(0, "127.0.0.1", resolve);
  });
  const { port } = receiverServer.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/hooks`,
    receivedBodies,
    close: () =>
      new Promise<void>((resolve) => {
        receiverServer.close(() => resolve());
      }),
  };
}

export function buildEndpointInput(
  endpointName: string,
  endpointUrl: string,
  changedFields: Record<string, unknown> = {},
) {
  return {
    name: endpointName,
    url: endpointUrl,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "native",
    template_mode: "linked",
    timeout_ms: 5_000,
    retry_policy: {
      max_attempts: 1,
      backoff_seconds: [1],
      retry_on_client_errors: false,
    },
    is_enabled: true,
    query_params: [],
    body_mode: "template",
    body_fields: [],
    fields_encoding: "json",
    raw_content_type: "application/json",
    raw_body: "",
    render_mode: "strict",
    ...changedFields,
  };
}

/** Creates an endpoint through the API and answers its id. */
export async function createEndpoint(
  request: APIRequestContext,
  endpointName: string,
  endpointUrl: string,
  changedFields: Record<string, unknown> = {},
): Promise<string> {
  const createResponse = await request.post("/api/v1/webhooks/endpoints", {
    data: buildEndpointInput(endpointName, endpointUrl, changedFields),
  });
  expect(createResponse.status()).toBe(201);

  return ((await createResponse.json()) as { id: string }).id;
}

export type RuleFilter = { field: string; operator: string; value: string };

/** Creates a rule through the API and answers its id. */
export async function createRule(
  request: APIRequestContext,
  ruleName: string,
  endpointId: string,
  events: string[],
  filter: RuleFilter | null = null,
): Promise<string> {
  const createResponse = await request.post("/api/v1/webhooks/rules", {
    data: {
      name: ruleName,
      endpoint_id: endpointId,
      events,
      filter,
      is_enabled: true,
    },
  });
  expect(createResponse.status()).toBe(201);

  return ((await createResponse.json()) as { id: string }).id;
}

/** Sends an email through the native API and answers its id. */
export async function sendEmail(
  request: APIRequestContext,
  subject: string,
  sender = "app@shop.test",
): Promise<string> {
  const sendResponse = await request.post("/api/v1/send", {
    data: {
      from: sender,
      to: ["sam@example.test"],
      subject,
      text: `Body of ${subject}`,
    },
  });
  expect(sendResponse.status()).toBe(201);

  return ((await sendResponse.json()) as { id: string }).id;
}

export type LiveDelivery = {
  id: string;
  attempt: number;
  status: string;
  event_type: string;
  trigger: string;
  is_edited: boolean;
};

/** The endpoint's deliveries, newest first. */
export async function listEndpointDeliveries(
  request: APIRequestContext,
  endpointId: string,
): Promise<LiveDelivery[]> {
  const listResponse = await request.get(
    `/api/v1/webhooks/deliveries?endpoint_id=${endpointId}`,
  );

  return (
    ((await listResponse.json()) as { items?: LiveDelivery[] }).items ?? []
  );
}

/** Waits until the endpoint has a delivery in `status`, and answers it. */
export async function waitForDelivery(
  request: APIRequestContext,
  endpointId: string,
  status: string,
): Promise<LiveDelivery> {
  await expect
    .poll(
      async () =>
        (await listEndpointDeliveries(request, endpointId)).some(
          (delivery) => delivery.status === status,
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  const deliveries = await listEndpointDeliveries(request, endpointId);

  return deliveries.find(
    (delivery) => delivery.status === status,
  ) as LiveDelivery;
}

export async function sendTestDelivery(
  request: APIRequestContext,
  endpointId: string,
): Promise<LiveDelivery> {
  const testResponse = await request.post(
    `/api/v1/webhooks/endpoints/${endpointId}/test`,
    { data: {} },
  );
  expect(testResponse.ok()).toBe(true);

  return (await testResponse.json()) as LiveDelivery;
}

export async function pickOption(
  page: Page,
  comboboxName: string,
  optionName: string,
) {
  await page.getByRole("combobox", { name: comboboxName }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

/** A variable name no other test uses: lowercase letters, digits and underscores. */
export function makeUniqueVariableName(prefix: string): string {
  nameCounter += 1;

  return `${prefix}_${Date.now().toString(36)}${nameCounter}`;
}

/** Creates a global webhook variable through the API. */
export async function createVariable(
  request: APIRequestContext,
  variableName: string,
  kind: string,
  value: string,
) {
  const createResponse = await request.post("/api/v1/webhooks/variables", {
    data: {
      name: variableName,
      kind,
      scope: "global",
      endpoint_id: null,
      value,
      random_mode: null,
      description: "",
    },
  });
  expect(createResponse.status()).toBe(201);
}
