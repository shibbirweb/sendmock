import { http, HttpResponse } from "msw";

import type {
  EmailOutcomeTestRequest,
  SmsOutcomeTestRequest,
} from "@/lib/api/types";
import { testEmailOutcome, testSmsOutcome } from "@/lib/outcomes/test-outcome";
import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";

/** Which rule, magic address or number, or profile decides an outcome (EM-10.6, SM-07.9). */
export const outcomeTestHandlers = [
  http.post("*/api/v1/outcome-rules/email/test", async ({ request }) => {
    await applyMockConditions();
    const { address } = (await request.json()) as EmailOutcomeTestRequest;

    return HttpResponse.json(
      testEmailOutcome(
        address ?? "",
        mockDatabase.emailOutcomeRules,
        mockDatabase.settings,
      ),
    );
  }),

  http.post("*/api/v1/outcome-rules/sms/test", async ({ request }) => {
    await applyMockConditions();
    const { number, match_field } =
      (await request.json()) as SmsOutcomeTestRequest;

    return HttpResponse.json(
      testSmsOutcome(
        number ?? "",
        match_field === "from" ? "from" : "to",
        mockDatabase.smsOutcomeRules,
        mockDatabase.settings,
      ),
    );
  }),
];
