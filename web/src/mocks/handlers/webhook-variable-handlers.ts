import { http, HttpResponse } from "msw";

import type {
  VariablePreviewRequest,
  WebhookVariable,
  WebhookVariableInput,
} from "@/lib/api/types";
import { validateWebhookVariableInput } from "@/lib/webhooks/validate-webhook-variable";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { resolveVariablePreview } from "@/mocks/webhooks/resolve-variable";

/** Secrets are stored and returned masked; the mock never needs them back. */
function maskVariableValue(variableInput: WebhookVariableInput): string {
  if (variableInput.kind !== "secret") {
    return variableInput.value;
  }

  return `••••••••${variableInput.value.slice(-4)}`;
}

/** The first reason a variable cannot be saved: its fields, or an expression that does not render. */
function readValidationError(
  variableInput: WebhookVariableInput,
  editedVariableId: string | null,
) {
  const otherVariables = mockDatabase.webhookVariables.filter(
    (webhookVariable) => webhookVariable.id !== editedVariableId,
  );
  const fieldError = Object.values(
    validateWebhookVariableInput(
      variableInput,
      otherVariables,
      editedVariableId !== null,
    ),
  ).find((validationError) => validationError !== undefined);

  return (
    fieldError ??
    resolveVariablePreview(mockDatabase, {
      kind: variableInput.kind,
      value: variableInput.value,
    }).errors[0]
  );
}

/** A Fixed random variable's value, generated from its expression. */
function generateFixedValue(
  variableInput: WebhookVariableInput,
): string | null {
  if (
    variableInput.kind !== "random" ||
    variableInput.random_mode !== "fixed"
  ) {
    return null;
  }

  return resolveVariablePreview(mockDatabase, {
    kind: "random",
    value: variableInput.value,
  }).resolved_value;
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
      fixed_value: generateFixedValue(variableInput),
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

      // An empty secret on edit keeps the stored one (WH-07.12).
      const isKeepingSecret =
        variableInput.kind === "secret" && variableInput.value === "";
      const isSameGenerator =
        webhookVariable.value === variableInput.value &&
        webhookVariable.random_mode === variableInput.random_mode;
      Object.assign(webhookVariable, variableInput, {
        value: isKeepingSecret
          ? webhookVariable.value
          : maskVariableValue(variableInput),
        fixed_value:
          isSameGenerator && webhookVariable.fixed_value !== null
            ? webhookVariable.fixed_value
            : generateFixedValue(variableInput),
      });

      return HttpResponse.json(webhookVariable);
    },
  ),

  http.post("*/api/v1/webhooks/variables/preview", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const previewRequest = (await request.json()) as VariablePreviewRequest;

    return HttpResponse.json(
      resolveVariablePreview(mockDatabase, previewRequest),
    );
  }),

  http.post(
    "*/api/v1/webhooks/variables/:variableId/regenerate",
    async ({ params }) => {
      await applyMockConditions();
      const webhookVariable = mockDatabase.webhookVariables.find(
        (existingVariable) => existingVariable.id === params.variableId,
      );
      if (!webhookVariable) {
        return createNotFoundResponse("Variable");
      }
      if (
        webhookVariable.kind !== "random" ||
        webhookVariable.random_mode !== "fixed"
      ) {
        return createErrorResponse(
          409,
          "not_fixed_random",
          "Only a Fixed random variable can be regenerated.",
        );
      }

      webhookVariable.fixed_value = generateFixedValue(webhookVariable);

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
