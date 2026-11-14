import { describe, expect, test } from "vitest";

import { describeResponseRule } from "@/lib/http/describe-response-rule";
import { buildTestResponseRule } from "@/lib/http/test-captured-request";
import { validateResponseRule } from "@/lib/http/validate-response-rule";
import { validateHttpBinName } from "@/lib/http/validate-http-bin";
import { buildCatchUrl } from "@/lib/http/build-catch-url";
import { readPresetDefaultResponse } from "@/lib/http/http-bin-presets";

describe("validateResponseRule", () => {
  test("HC-02.4 accepts a complete rule and names each problem", () => {
    expect(validateResponseRule(buildTestResponseRule())).toEqual({});
    expect(
      validateResponseRule(
        buildTestResponseRule({
          name: " ",
          path_glob: "v1/*",
          response: { status_code: 99, headers: {}, body: "" },
          delay_min_ms: 2000,
          delay_max_ms: 500,
          failure_rate_percent: 120,
          filter: { field: "body", operator: "contains", value: "" },
        }),
      ),
    ).toEqual({
      name: "Enter a name",
      path_glob: "Start the path with /, e.g. /v1/*",
      filter: "Enter a value",
      status_code: "Use a status code from 100 to 599",
      delay: "Use 0 to 30,000 ms, the shortest first",
      failure: "Use 0 to 100% and a status code from 100 to 599",
    });
  });
});

describe("describeResponseRule", () => {
  test("HC-02.4 summarises match, status, delay and failures in one line", () => {
    expect(
      describeResponseRule(
        buildTestResponseRule({
          method: "POST",
          path_glob: "/v1/*",
          filter: { field: "header:x-env", operator: "equals", value: "test" },
          delay_min_ms: 500,
          delay_max_ms: 2000,
          failure_rate_percent: 10,
        }),
      ),
    ).toBe(
      "POST /v1/* when header x-env is test: 429 after 0.5 to 2 s, 10% fail with 500",
    );
    expect(describeResponseRule(buildTestResponseRule())).toBe(
      "Any method any path: 429",
    );
  });
});

describe("bins", () => {
  test("HC-01.6 bin names are slugs and unique", () => {
    expect(
      validateHttpBinName({ name: "push-ios", preset: null }, []),
    ).toBeNull();
    expect(validateHttpBinName({ name: "Push iOS", preset: null }, [])).toMatch(
      /lowercase/,
    );
    expect(
      validateHttpBinName({ name: "slack", preset: null }, [
        {
          id: "1",
          name: "slack",
          preset: null,
          request_count: 0,
          last_request_at: null,
          default_response: readPresetDefaultResponse(null),
        },
      ]),
    ).toBe("A bin named slack already exists");
  });

  test("presets set the reply the real service sends; none answers ok JSON", () => {
    expect(readPresetDefaultResponse("slack")).toMatchObject({
      status_code: 200,
      body: "ok",
    });
    expect(readPresetDefaultResponse("discord").status_code).toBe(204);
    expect(readPresetDefaultResponse(null)).toMatchObject({
      body: '{"ok":true}',
    });
  });

  test("the catch URL is reachable from this machine", () => {
    expect(buildCatchUrl("0.0.0.0:8025", "slack")).toBe(
      "http://127.0.0.1:8025/catch/slack",
    );
    expect(buildCatchUrl("127.0.0.1:9000", "push")).toBe(
      "http://127.0.0.1:9000/catch/push",
    );
  });
});
