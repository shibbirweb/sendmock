import { http, HttpResponse } from "msw";

import type { WebhookVariable, WebhookVariableInput } from "@/lib/api/types";
import { validateWebhookVariableInput } from "@/lib/webhooks/validate-webhook-variable";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

/** Secrets are stored and returned masked; the mock never needs them back. */
function maskVariableValue(variableInput: WebhookVariableInput): string {
  if (variableInput.kind !== "secret") {
    return variableInput.value;
  }

  return `••••••••${variableInput.value.slice(-4)}`;
}

function readValidationError(
  variableInput: WebhookVariableInput,
  editedVariableId: string | null,
) {
  const otherVariables = mockDatabase.webhookVariables.filter(
    (webhookVariable) => webhookVariable.id !== editedVariableId,
  );

  return Object.values(
    validateWebhookVariableInput(variableInput, otherVariables),
  ).find((fieldError) => fieldError !== undefined);
}

/** Global and endpoint variables (`?endpoint_id=` narrows to one endpoint). */
export const webhookVariableHandlers = [
  http.get("*/api/v1/webhooks/variables", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    const endpointId = new URL(request.url).searchParams.get("endpoint_id");
    const matchingVariables = mockDatabase.webhookVariables.filter(
      (webhookVariable) =>
        endpointId === null || webhookVariable.endpoint_id === endpointId,
    );

    return conditionResponse ?? HttpResponse.json(matchingVariables);
  }),

  http.post("*/api/v1/webhooks/variables", async ({ request }) => {
    await applyMockConditions();
    const variableInput = (await request.json()) as WebhookVariableInput;
    const validationError = readValidationError(variableInput, null);
    if (validationError !== undefined) {
      return createErrorResponse(400, "validation_failed", validationError);
    }

    const webhookVariable: WebhookVariable = {
      ...variableInput,
      id: createMockUlid(),
      value: maskVariableValue(variableInput),
      created_by: "ui",
    };
    mockDatabase.webhookVariables.push(webhookVariable);

    return HttpResponse.json(webhookVariable, { status: 201 });
  }),

  http.patch(
    "*/api/v1/webhooks/variables/:variableId",
    async ({ params, request }) => {
      await applyMockConditions();
      const webhookVariable = mockDatabase.webhookVariables.find(
        (existingVariable) => existingVariable.id === params.variableId,
      );
      if (!webhookVariable) {
        return createNotFoundResponse("Variable");
      }

      const variableInput = (await request.json()) as WebhookVariableInput;
      const validationError = readValidationError(
        variableInput,
        webhookVariable.id,
      );
      if (validationError !== undefined) {
        return createErrorResponse(400, "validation_failed", validationError);
      }

      Object.assign(webhookVariable, variableInput, {
        value: maskVariableValue(variableInput),
      });

      return HttpResponse.json(webhookVariable);
    },
  ),

  http.delete("*/api/v1/webhooks/variables/:variableId", async ({ params }) => {
    await applyMockConditions();
    const variableCountBefore = mockDatabase.webhookVariables.length;
    mockDatabase.webhookVariables = mockDatabase.webhookVariables.filter(
      (webhookVariable) => webhookVariable.id !== params.variableId,
    );
    if (mockDatabase.webhookVariables.length === variableCountBefore) {
      return createNotFoundResponse("Variable");
    }

    return new HttpResponse(null, { status: 204 });
  }),
];
