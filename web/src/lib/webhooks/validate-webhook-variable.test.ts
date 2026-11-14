import { describe, expect, test } from "vitest";

import type { VariableKind, WebhookVariableInput } from "@/lib/api/types";
import { validateWebhookVariableInput } from "@/lib/webhooks/validate-webhook-variable";

function buildInput(
  kind: VariableKind,
  value: string,
  randomMode: WebhookVariableInput["random_mode"] = null,
): WebhookVariableInput {
  return {
    name: "sample_value",
    kind,
    scope: "global",
    endpoint_id: null,
    value,
    random_mode: randomMode,
    description: "",
  };
}

describe("validateWebhookVariableInput per kind", () => {
  test("WH-07.12 checks numbers, booleans and JSON", () => {
    expect(
      validateWebhookVariableInput(buildInput("number", "abc"), []).value,
    ).toBe("Enter a number");
    expect(
      validateWebhookVariableInput(buildInput("number", "4.5"), []),
    ).toEqual({});
    expect(
      validateWebhookVariableInput(buildInput("boolean", "yes"), []).value,
    ).toBe("Use true or false");
    expect(
      validateWebhookVariableInput(buildInput("boolean", "false"), []),
    ).toEqual({});
    expect(
      validateWebhookVariableInput(buildInput("json", "{ nope"), []).value,
    ).toBe("Enter valid JSON");
    expect(
      validateWebhookVariableInput(buildInput("json", '{"env":"local"}'), []),
    ).toEqual({});
  });

  test("WH-07.12 expressions need a value and a prompt may be empty", () => {
    expect(
      validateWebhookVariableInput(buildInput("dynamic", " "), []).value,
    ).toMatch(/^Enter a path/);
    expect(
      validateWebhookVariableInput(buildInput("computed", ""), []).value,
    ).toMatch(/^Enter a template/);
    expect(validateWebhookVariableInput(buildInput("prompt", ""), [])).toEqual(
      {},
    );
  });

  test("WH-07.12 an empty secret is allowed only when keeping the stored one", () => {
    expect(
      validateWebhookVariableInput(buildInput("secret", ""), []).value,
    ).toBe("Enter the secret");
    expect(
      validateWebhookVariableInput(buildInput("secret", ""), [], true),
    ).toEqual({});
  });

  test("WH-07.13 a random variable needs Per send or Fixed", () => {
    expect(
      validateWebhookVariableInput(buildInput("random", "random_string(8)"), [])
        .random_mode,
    ).toBe("Pick Per send or Fixed");
    expect(
      validateWebhookVariableInput(
        buildInput("random", "random_string(8)", "fixed"),
        [],
      ),
    ).toEqual({});
  });
});
