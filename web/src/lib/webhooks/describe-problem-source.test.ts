import { describe, expect, test } from "vitest";

import type { RenderProblem, WebhookEndpointInput } from "@/lib/api/types";
import {
  describeProblemSource,
  findRequestPart,
} from "@/lib/webhooks/describe-problem-source";

const endpointInput = {
  query_params: [
    {
      name: "ref",
      value: "{{ x }}",
    },
  ],
  headers: { "X-Tenant": "{{ y }}" },
  body_fields: [
    {
      name: "user.email",
      value_type: "text",
      value: "{{ z }}",
    },
  ],
} as unknown as WebhookEndpointInput;

function buildProblem(changedFields: Partial<RenderProblem>): RenderProblem {
  return {
    message: "Undefined variable: x",
    severity: "warning",
    source: "body",
    line: null,
    column: null,
    ...changedFields,
  };
}

describe("describeProblemSource", () => {
  test("WH-07.15 names the part each problem comes from", () => {
    expect(
      describeProblemSource(buildProblem({ source: "url" }), endpointInput),
    ).toBe("URL");
    expect(
      describeProblemSource(buildProblem({ source: "query.0" }), endpointInput),
    ).toBe("Query param ref");
    expect(
      describeProblemSource(
        buildProblem({ source: "header.0" }),
        endpointInput,
      ),
    ).toBe("Header X-Tenant");
    expect(
      describeProblemSource(buildProblem({ source: "field.0" }), endpointInput),
    ).toBe("Field user.email");
    expect(
      describeProblemSource(
        buildProblem({ line: 3, column: 12 }),
        endpointInput,
      ),
    ).toBe("Body, line 3 column 12");
  });

  test("WH-07.15 groups query params with the URL and fields with the body", () => {
    expect(findRequestPart("query.2")).toBe("url");
    expect(findRequestPart("header.0")).toBe("headers");
    expect(findRequestPart("field.1")).toBe("body");
  });
});
