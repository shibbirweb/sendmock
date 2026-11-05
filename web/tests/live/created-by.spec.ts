import { type APIRequestContext, expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

/** Creates an endpoint as the CLI or an agent does: they name themselves in this header. */
async function createEndpointAs(
  request: APIRequestContext,
  endpointName: string,
  requestClient: "cli" | "mcp",
) {
  const response = await request.post("/api/v1/webhooks/endpoints", {
    headers: { "X-Sendmock-Client": requestClient },
    data: {
      name: endpointName,
      url: "http://localhost:3000/webhooks/sendmock",
      method: "POST",
      headers: {},
      extra_fields: {},
      template_id: "native",
      template_mode: "linked",
      timeout_ms: 10_000,
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
    },
  });
  expect(response.status()).toBe(201);
}

test("AI-05.4 the live Endpoints screen badges what the CLI and an agent made", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  await createEndpointAs(request, "Made with the CLI", "cli");
  await createEndpointAs(request, "Made by an agent", "mcp");

  await page.goto("/webhooks/endpoints");

  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Made with the CLI" })
      .getByText("CLI", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Made by an agent" })
      .getByText("MCP", { exact: true }),
  ).toBeVisible();
  expect(failedApiCalls).toEqual([]);
});
