import { describe, expect, test } from "vitest";

import {
  findAnsweringRule,
  matchResponseRule,
  readPathInBin,
} from "@/lib/http/match-response-rule";
import {
  buildTestCapturedRequest,
  buildTestResponseRule,
} from "@/lib/http/test-captured-request";

describe("matchResponseRule", () => {
  test("HC-02.1 matches on method, path glob relative to the bin, and header conditions", () => {
    const capturedRequest = buildTestCapturedRequest();

    expect(
      matchResponseRule(
        buildTestResponseRule({
          method: "POST",
          path_glob: "/tr*",
          filter: {
            field: "header:X-Test-Mode",
            operator: "equals",
            value: "rate-limit",
          },
        }),
        capturedRequest,
      ),
    ).toEqual({ isMatch: true, mismatchReason: null });
    expect(
      matchResponseRule(
        buildTestResponseRule({ method: "GET" }),
        capturedRequest,
      ).mismatchReason,
    ).toBe("Method is POST, not GET");
    expect(
      matchResponseRule(
        buildTestResponseRule({ path_glob: "/batch" }),
        capturedRequest,
      ).mismatchReason,
    ).toBe("Path /track does not match /batch");
    expect(
      matchResponseRule(
        buildTestResponseRule({
          filter: { field: "body", operator: "contains", value: "purchase" },
        }),
        capturedRequest,
      ).isMatch,
    ).toBe(false);
  });

  test("HC-02.1 the first enabled match answers; none means the default reply", () => {
    const capturedRequest = buildTestCapturedRequest();
    const disabledRule = buildTestResponseRule({ id: "a", is_enabled: false });
    const firstMatch = buildTestResponseRule({ id: "b" });
    const secondMatch = buildTestResponseRule({ id: "c" });

    expect(
      findAnsweringRule(
        [disabledRule, firstMatch, secondMatch],
        capturedRequest,
      )?.id,
    ).toBe("b");
    expect(
      findAnsweringRule(
        [buildTestResponseRule({ method: "GET" })],
        capturedRequest,
      ),
    ).toBeNull();
  });

  test("reads the path inside the bin", () => {
    expect(readPathInBin("/catch/slack", "slack")).toBe("/");
    expect(readPathInBin("/catch/push/v1/send", "push")).toBe("/v1/send");
  });
});
