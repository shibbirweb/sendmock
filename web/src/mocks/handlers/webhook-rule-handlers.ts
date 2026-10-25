import { http, HttpResponse } from "msw";

import type {
  RulePreviewRequest,
  WebhookRule,
  WebhookRuleInput,
  WebhookRuleMove,
} from "@/lib/api/types";
import { validateWebhookRuleInput } from "@/lib/webhooks/rule-filter/validate-rule-filter";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { previewRuleFilter } from "@/mocks/webhooks/preview-rule-filter";

function listRulesInOrder(): WebhookRule[] {
  return [...mockDatabase.webhookRules].sort(
    (firstRule, secondRule) => firstRule.order - secondRule.order,
  );
}

function findRule(ruleId: unknown) {
  return mockDatabase.webhookRules.find(
    (webhookRule) => webhookRule.id === ruleId,
  );
}

function readValidationError(ruleInput: WebhookRuleInput) {
  const fieldErrors = validateWebhookRuleInput(ruleInput);
  if (
    ruleInput.endpoint_id !== "" &&
    !mockDatabase.webhookEndpoints.some(
      (endpointRecord) => endpointRecord.id === ruleInput.endpoint_id,
    )
  ) {
    fieldErrors.endpoint_id = "That endpoint does not exist";
  }

  return Object.values(fieldErrors).find(
    (fieldError) => fieldError !== undefined,
  );
}

/** Webhook rules: CRUD, reordering and the match preview (WH-02). */
export const webhookRuleHandlers = [
  http.get("*/api/v1/webhooks/rules", async () => {
    const conditionResponse = await applyMockConditions();

    return conditionResponse ?? HttpResponse.json(listRulesInOrder());
  }),

  http.post("*/api/v1/webhooks/rules/preview", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const previewRequest = (await request.json()) as RulePreviewRequest;

    return HttpResponse.json(previewRuleFilter(mockDatabase, previewRequest));
  }),

  http.post("*/api/v1/webhooks/rules", async ({ request }) => {
    await applyMockConditions();
    const ruleInput = (await request.json()) as WebhookRuleInput;
    const validationError = readValidationError(ruleInput);
    if (validationError !== undefined) {
      return createErrorResponse(400, "validation_failed", validationError);
    }

    const lastOrder = Math.max(
      0,
      ...mockDatabase.webhookRules.map((webhookRule) => webhookRule.order),
    );
    const webhookRule: WebhookRule = {
      ...ruleInput,
      name: ruleInput.name.trim(),
      id: createMockUlid(),
      order: lastOrder + 1,
      created_by: "ui",
    };
    mockDatabase.webhookRules.push(webhookRule);

    return HttpResponse.json(webhookRule, { status: 201 });
  }),

  http.patch("*/api/v1/webhooks/rules/:ruleId", async ({ params, request }) => {
    await applyMockConditions();
    const webhookRule = findRule(params.ruleId);
    if (!webhookRule) {
      return createNotFoundResponse("Rule");
    }

    const ruleUpdate = (await request.json()) as Partial<WebhookRuleInput>;
    const updatedRule = { ...webhookRule, ...ruleUpdate };
    const validationError = readValidationError(updatedRule);
    if (validationError !== undefined) {
      return createErrorResponse(400, "validation_failed", validationError);
    }

    Object.assign(webhookRule, updatedRule, { name: updatedRule.name.trim() });

    return HttpResponse.json(webhookRule);
  }),

  http.post(
    "*/api/v1/webhooks/rules/:ruleId/move",
    async ({ params, request }) => {
      await applyMockConditions();
      const orderedRules = listRulesInOrder();
      const ruleIndex = orderedRules.findIndex(
        (webhookRule) => webhookRule.id === params.ruleId,
      );
      if (ruleIndex === -1) {
        return createNotFoundResponse("Rule");
      }

      const { direction } = (await request.json()) as WebhookRuleMove;
      const neighbourRule =
        orderedRules[direction === "up" ? ruleIndex - 1 : ruleIndex + 1];
      const movedRule = orderedRules[ruleIndex];
      if (neighbourRule !== undefined && movedRule !== undefined) {
        [movedRule.order, neighbourRule.order] = [
          neighbourRule.order,
          movedRule.order,
        ];
      }

      return HttpResponse.json(listRulesInOrder());
    },
  ),

  http.delete("*/api/v1/webhooks/rules/:ruleId", async ({ params }) => {
    await applyMockConditions();
    if (!findRule(params.ruleId)) {
      return createNotFoundResponse("Rule");
    }

    mockDatabase.webhookRules = mockDatabase.webhookRules.filter(
      (webhookRule) => webhookRule.id !== params.ruleId,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
