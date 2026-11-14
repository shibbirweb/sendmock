import { http, HttpResponse } from "msw";

import type {
  EmailOutcomeRule,
  EmailOutcomeRuleInput,
  OutcomeRuleMove,
  SmsOutcomeRule,
  SmsOutcomeRuleInput,
} from "@/lib/api/types";
import {
  validateEmailOutcomeRuleInput,
  validateSmsOutcomeRuleInput,
} from "@/lib/outcomes/validate-outcome-rules";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

type OrderedRule = { id: string; position: number };

type RuleCollection<OutcomeRule extends OrderedRule, RuleInput> = {
  apiPath: string;
  readRules: () => OutcomeRule[];
  writeRules: (outcomeRules: OutcomeRule[]) => void;
  validateInput: (ruleInput: RuleInput) => Record<string, string | undefined>;
};

function sortByPosition<OutcomeRule extends OrderedRule>(
  outcomeRules: OutcomeRule[],
) {
  return outcomeRules.toSorted(
    (firstRule, secondRule) => firstRule.position - secondRule.position,
  );
}

/** Positions 1..n after any change, so the order has no gaps. */
function renumber<OutcomeRule extends OrderedRule>(
  outcomeRules: OutcomeRule[],
): OutcomeRule[] {
  return outcomeRules.map((outcomeRule, ruleIndex) => ({
    ...outcomeRule,
    position: ruleIndex + 1,
  }));
}

function readFirstError(fieldErrors: Record<string, string | undefined>) {
  return Object.values(fieldErrors).find(
    (fieldError) => fieldError !== undefined,
  );
}

/** List, create, edit, move and delete for one kind of outcome rule (SM-07.7, EM-10.5). */
function buildRuleHandlers<
  OutcomeRule extends OrderedRule,
  RuleInput extends object,
>(ruleCollection: RuleCollection<OutcomeRule, RuleInput>) {
  const { apiPath, readRules, writeRules, validateInput } = ruleCollection;

  return [
    http.get(`*/api/v1/outcome-rules/${apiPath}`, async () => {
      await applyMockConditions();

      return HttpResponse.json(sortByPosition(readRules()));
    }),

    http.post(`*/api/v1/outcome-rules/${apiPath}`, async ({ request }) => {
      await applyMockConditions();
      const ruleInput = (await request.json()) as RuleInput;
      const firstError = readFirstError(validateInput(ruleInput));
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }

      const createdRule = {
        ...ruleInput,
        id: createMockUlid(),
        position: readRules().length + 1,
        created_by: "ui",
      } as unknown as OutcomeRule;
      writeRules([...sortByPosition(readRules()), createdRule]);

      return HttpResponse.json(createdRule, { status: 201 });
    }),

    http.patch(
      `*/api/v1/outcome-rules/${apiPath}/:ruleId`,
      async ({ params, request }) => {
        await applyMockConditions();
        const existingRule = readRules().find(
          (outcomeRule) => outcomeRule.id === params.ruleId,
        );
        if (existingRule === undefined) {
          return createNotFoundResponse("Outcome rule");
        }

        const ruleInput = (await request.json()) as RuleInput;
        const firstError = readFirstError(
          validateInput({ ...existingRule, ...ruleInput }),
        );
        if (firstError !== undefined) {
          return createErrorResponse(400, "validation_failed", firstError);
        }

        const updatedRule = { ...existingRule, ...ruleInput };
        writeRules(
          readRules().map((outcomeRule) =>
            outcomeRule.id === existingRule.id ? updatedRule : outcomeRule,
          ),
        );

        return HttpResponse.json(updatedRule);
      },
    ),

    http.post(
      `*/api/v1/outcome-rules/${apiPath}/:ruleId/move`,
      async ({ params, request }) => {
        await applyMockConditions();
        const orderedRules = sortByPosition(readRules());
        const ruleIndex = orderedRules.findIndex(
          (outcomeRule) => outcomeRule.id === params.ruleId,
        );
        if (ruleIndex === -1) {
          return createNotFoundResponse("Outcome rule");
        }

        const { direction } = (await request.json()) as OutcomeRuleMove;
        const targetIndex = direction === "up" ? ruleIndex - 1 : ruleIndex + 1;
        const movedRule = orderedRules[ruleIndex];
        const swappedRule = orderedRules[targetIndex];
        if (movedRule !== undefined && swappedRule !== undefined) {
          orderedRules[targetIndex] = movedRule;
          orderedRules[ruleIndex] = swappedRule;
        }
        writeRules(renumber(orderedRules));

        return HttpResponse.json(sortByPosition(readRules()));
      },
    ),

    http.delete(
      `*/api/v1/outcome-rules/${apiPath}/:ruleId`,
      async ({ params }) => {
        await applyMockConditions();
        writeRules(
          renumber(
            sortByPosition(readRules()).filter(
              (outcomeRule) => outcomeRule.id !== params.ruleId,
            ),
          ),
        );

        return new HttpResponse(null, { status: 204 });
      },
    ),
  ];
}

export const outcomeRulesHandlers = [
  ...buildRuleHandlers<SmsOutcomeRule, SmsOutcomeRuleInput>({
    apiPath: "sms",
    readRules: () => mockDatabase.smsOutcomeRules,
    writeRules: (outcomeRules) => {
      mockDatabase.smsOutcomeRules = outcomeRules;
    },
    validateInput: validateSmsOutcomeRuleInput,
  }),
  ...buildRuleHandlers<EmailOutcomeRule, EmailOutcomeRuleInput>({
    apiPath: "email",
    readRules: () => mockDatabase.emailOutcomeRules,
    writeRules: (outcomeRules) => {
      mockDatabase.emailOutcomeRules = outcomeRules;
    },
    validateInput: validateEmailOutcomeRuleInput,
  }),
];
