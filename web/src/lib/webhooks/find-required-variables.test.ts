import { describe, expect, test } from "vitest";

import type { WebhookVariable } from "@/lib/api/types";
import { findRequiredVariableStates } from "@/lib/webhooks/find-required-variables";
import {
  isSecretVariableName,
  validateWebhookVariableInput,
} from "@/lib/webhooks/validate-webhook-variable";

function buildVariable(
  variableName: string,
  endpointId: string | null,
): WebhookVariable {
  return {
    id: `variable-${variableName}-${endpointId ?? "global"}`,
    name: variableName,
    kind: "text",
    scope: endpointId === null ? "global" : "endpoint",
    endpoint_id: endpointId,
    value: "value",
    random_mode: null,
    description: "",
    created_by: "ui",
  };
}

describe("findRequiredVariableStates", () => {
  test("WH-01.6 says where each required variable is set, endpoint first", () => {
    expect(
      findRequiredVariableStates(
        ["tenant_id", "twilio_auth_token", "telegram_chat_id"],
        [buildVariable("tenant_id", "endpoint-1")],
        [
          buildVariable("tenant_id", null),
          buildVariable("telegram_chat_id", null),
        ],
      ),
    ).toEqual([
      { variableName: "tenant_id", source: "endpoint" },
      { variableName: "twilio_auth_token", source: "missing" },
      { variableName: "telegram_chat_id", source: "global" },
    ]);
  });
});

describe("webhook variable rules", () => {
  test("WH-01.6 treats token, secret, key and password names as secrets", () => {
    expect(isSecretVariableName("twilio_auth_token")).toBe(true);
    expect(isSecretVariableName("mailgun_signing_key")).toBe(true);
    expect(isSecretVariableName("resend_signing_secret")).toBe(true);
    expect(isSecretVariableName("db_password")).toBe(true);
    expect(isSecretVariableName("telegram_chat_id")).toBe(false);
  });

  test("needs a lowercase name unique in its scope and a value", () => {
    const existingVariables = [buildVariable("tenant_id", "endpoint-1")];

    expect(
      validateWebhookVariableInput(
        {
          name: "Tenant",
          kind: "text",
          scope: "endpoint",
          endpoint_id: "endpoint-1",
          value: " ",
          random_mode: null,
          description: "",
        },
        existingVariables,
      ),
    ).toEqual({
      name: "Use lowercase letters, digits and underscores, starting with a letter",
      value: "Enter a value",
    });
    expect(
      validateWebhookVariableInput(
        {
          name: "tenant_id",
          kind: "text",
          scope: "endpoint",
          endpoint_id: "endpoint-1",
          value: "acme",
          random_mode: null,
          description: "",
        },
        existingVariables,
      ).name,
    ).toBe("A variable with this name already exists here");
  });
});
