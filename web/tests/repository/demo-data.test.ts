import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { buildDemoSteps } from "../../src/mocks/demo/build-demo-steps";

const embeddedDemoData = JSON.parse(
  readFileSync("../crates/sendmock-ops/builtin/demo-data.json", "utf8"),
) as { steps: unknown[] };
const openapiDocument = JSON.parse(
  readFileSync("src/mocks/generated/openapi-document.json", "utf8"),
) as { paths: Record<string, Record<string, { operationId?: string }>> };
const contractOperationIds = new Set(
  Object.values(openapiDocument.paths).flatMap((pathItem) =>
    Object.values(pathItem).map((operation) => operation.operationId),
  ),
);

test("PL-09.3 the demo data the binary embeds is the mock's fixtures as operation calls", () => {
  expect(embeddedDemoData.steps).toEqual(
    JSON.parse(JSON.stringify(buildDemoSteps())) as unknown[],
  );
});

test("PL-09.3 every demo step is a contract operation, and every placeholder names the address or an earlier saved step", () => {
  const savedNames = new Set<string>();
  for (const demoStep of buildDemoSteps()) {
    expect(contractOperationIds.has(demoStep.operation_id)).toBe(true);
    const placeholders =
      JSON.stringify(demoStep.input).match(/\{\{[^}]*\}\}/g) ?? [];
    for (const placeholder of placeholders) {
      const savedMatch = /^\{\{saved\.([a-z0-9_]+)\.[a-z_]+\}\}$/.exec(
        placeholder,
      );
      expect(
        placeholder === "{{http_address}}" ||
          (savedMatch !== null && savedNames.has(savedMatch[1] ?? "")),
      ).toBe(true);
    }
    if (demoStep.save_as !== undefined) {
      savedNames.add(demoStep.save_as);
    }
  }
});

test("PL-09.2 every demo webhook endpoint posts to SendMock's own catcher", () => {
  const endpointUrls = buildDemoSteps()
    .filter((demoStep) => demoStep.operation_id === "postWebhooksEndpoints")
    .map((demoStep) => String(demoStep.input.url));

  expect(endpointUrls.length).toBeGreaterThan(0);
  for (const endpointUrl of endpointUrls) {
    expect(endpointUrl.startsWith("http://{{http_address}}/catch/")).toBe(true);
  }
});
