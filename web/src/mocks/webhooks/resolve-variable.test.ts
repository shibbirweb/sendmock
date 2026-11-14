import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { resolveVariablePreview } from "@/mocks/webhooks/resolve-variable";

describe("resolveVariablePreview", () => {
  const mockDatabase = createMockDatabase("standard");

  test("WH-07.12 evaluates dynamic expressions against the sample email", () => {
    expect(
      resolveVariablePreview(mockDatabase, {
        kind: "dynamic",
        value: "data.subject | upper",
      }),
    ).toEqual({
      resolved_value: "YOUR VERIFICATION CODE",
      warnings: [],
      errors: [],
    });
  });

  test("WH-07.12 renders computed templates and masks secrets", () => {
    expect(
      resolveVariablePreview(mockDatabase, {
        kind: "computed",
        value: "{{ vars.tenant_id }}-x",
      }).resolved_value,
    ).toBe("acme-x");
    expect(
      resolveVariablePreview(mockDatabase, {
        kind: "secret",
        value: "sk_live_123",
      }).resolved_value,
    ).toBe("••••••••");
    expect(
      resolveVariablePreview(mockDatabase, { kind: "number", value: "5" })
        .resolved_value,
    ).toBe("5");
  });

  test("WH-07.13 random generators produce a value", () => {
    expect(
      resolveVariablePreview(mockDatabase, {
        kind: "random",
        value: "random_string(10)",
      }).resolved_value,
    ).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  test("WH-07.12 reports what does not render", () => {
    expect(
      resolveVariablePreview(mockDatabase, {
        kind: "dynamic",
        value: "data.subject | shout",
      }).errors,
    ).toEqual(["Unknown filter: shout"]);
  });
});
