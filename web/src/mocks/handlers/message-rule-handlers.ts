import { http, HttpResponse } from "msw";

import type {
  ForwardRuleInput,
  MessageRuleMove,
  TagRuleInput,
} from "@/lib/api/types";
import { findFirstFilterError } from "@/lib/webhooks/rule-filter/validate-rule-filter";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

type MessageRuleKind = "tag-rules" | "forward-rules";
type StoredRule = {
  id: string;
  position: number;
  filter: TagRuleInput["filter"];
};

function listRules(ruleKind: MessageRuleKind): StoredRule[] {
  return ruleKind === "tag-rules"
    ? mockDatabase.messageRules.tagRules
    : mockDatabase.messageRules.forwardRules;
}

function sortedRules(ruleKind: MessageRuleKind) {
  return listRules(ruleKind).toSorted(
    (firstRule, secondRule) => firstRule.position - secondRule.position,
  );
}

/** The same checks the UI makes: a name, a tag or an address, and a valid filter. */
function readInputError(
  ruleKind: MessageRuleKind,
  ruleInput: Partial<TagRuleInput & ForwardRuleInput>,
): string | null {
  if (ruleInput.name !== undefined && ruleInput.name.trim() === "") {
    return "Enter a name";
  }
  if (
    ruleKind === "tag-rules" &&
    ruleInput.tag !== undefined &&
    ruleInput.tag.trim() === ""
  ) {
    return "Enter the tag to add";
  }
  if (
    ruleKind === "forward-rules" &&
    ruleInput.to !== undefined &&
    ruleInput.to.length === 0
  ) {
    return "Add at least one address to forward to";
  }

  return ruleInput.filter
    ? (findFirstFilterError(ruleInput.filter) ?? null)
    : null;
}

function buildRuleHandlers(ruleKind: MessageRuleKind) {
  const basePath = `*/api/v1/${ruleKind}`;

  return [
    http.get(basePath, async () => {
      const conditionResponse = await applyMockConditions();

      return conditionResponse ?? HttpResponse.json(sortedRules(ruleKind));
    }),

    http.post(basePath, async ({ request }) => {
      await applyMockConditions();
      const ruleInput = (await request.json()) as TagRuleInput &
        ForwardRuleInput;
      const inputError = readInputError(ruleKind, ruleInput);
      if (inputError !== null) {
        return createErrorResponse(400, "validation_failed", inputError);
      }
      const storedRule = {
        ...ruleInput,
        id: createMockUlid(),
        position: listRules(ruleKind).length + 1,
      };
      listRules(ruleKind).push(storedRule);

      return HttpResponse.json(storedRule, { status: 201 });
    }),

    http.patch(`${basePath}/:ruleId`, async ({ params, request }) => {
      await applyMockConditions();
      const storedRule = listRules(ruleKind).find(
        (rule) => rule.id === params.ruleId,
      );
      if (storedRule === undefined) {
        return createNotFoundResponse("Rule");
      }
      const ruleChanges = (await request.json()) as Partial<
        TagRuleInput & ForwardRuleInput
      >;
      const inputError = readInputError(ruleKind, ruleChanges);
      if (inputError !== null) {
        return createErrorResponse(400, "validation_failed", inputError);
      }
      Object.assign(storedRule, ruleChanges);

      return HttpResponse.json(storedRule);
    }),

    http.delete(`${basePath}/:ruleId`, async ({ params }) => {
      await applyMockConditions();
      const remainingRules = sortedRules(ruleKind).filter(
        (rule) => rule.id !== params.ruleId,
      );
      if (remainingRules.length === listRules(ruleKind).length) {
        return createNotFoundResponse("Rule");
      }
      remainingRules.forEach((rule, ruleIndex) => {
        rule.position = ruleIndex + 1;
      });
      listRules(ruleKind).splice(0, Infinity, ...remainingRules);

      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${basePath}/:ruleId/move`, async ({ params, request }) => {
      await applyMockConditions();
      const orderedRules = sortedRules(ruleKind);
      const ruleIndex = orderedRules.findIndex(
        (rule) => rule.id === params.ruleId,
      );
      if (ruleIndex === -1) {
        return createNotFoundResponse("Rule");
      }
      const { direction } = (await request.json()) as MessageRuleMove;
      const targetIndex = direction === "up" ? ruleIndex - 1 : ruleIndex + 1;
      const [movedRule] = orderedRules.splice(ruleIndex, 1);
      if (movedRule !== undefined) {
        orderedRules.splice(
          Math.max(0, Math.min(targetIndex, orderedRules.length)),
          0,
          movedRule,
        );
      }
      orderedRules.forEach((rule, orderIndex) => {
        rule.position = orderIndex + 1;
      });

      return HttpResponse.json(sortedRules(ruleKind));
    }),
  ];
}

/** Tag and auto-forward rules (EM-12.3, EM-14.3, UI-11.5). */
export const messageRuleHandlers = [
  ...buildRuleHandlers("tag-rules"),
  ...buildRuleHandlers("forward-rules"),
];
