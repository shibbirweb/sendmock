import { describe, expect, test } from "vitest";

import { queryKeys } from "@/lib/api/query-keys";

type QueryKeyArea = Record<string, unknown> & { all?: readonly unknown[] };

/** Every key builder of an area, called with sample arguments. */
function listAreaKeys(queryKeyArea: QueryKeyArea): (readonly unknown[])[] {
  return Object.entries(queryKeyArea)
    .filter(([keyName]) => keyName !== "all")
    .map(([, keyBuilder]) =>
      typeof keyBuilder === "function"
        ? (keyBuilder as (sampleArgument: unknown) => readonly unknown[])(
            "sample-id",
          )
        : (keyBuilder as readonly unknown[]),
    );
}

describe("queryKeys", () => {
  test("PL-02.1 every key starts with its area key, so realtime refreshes reach it", () => {
    for (const [areaName, queryKeyArea] of Object.entries(queryKeys)) {
      const areaKey = (queryKeyArea as QueryKeyArea).all;
      if (areaKey === undefined) {
        continue;
      }

      for (const areaQueryKey of listAreaKeys(queryKeyArea as QueryKeyArea)) {
        expect(
          areaQueryKey.slice(0, areaKey.length),
          `${areaName} key`,
        ).toEqual(areaKey);
      }
    }
  });

  test("keys include their arguments so different emails do not share a cache", () => {
    expect(queryKeys.emails.detail("01A")).not.toEqual(
      queryKeys.emails.detail("01B"),
    );
    expect(queryKeys.emails.list({ query: "otp" })).toEqual([
      "emails",
      "list",
      { query: "otp" },
    ]);
    expect(queryKeys.httpCatcher.requests(null)).toEqual([
      "http-catcher",
      "requests",
      null,
    ]);
  });
});
