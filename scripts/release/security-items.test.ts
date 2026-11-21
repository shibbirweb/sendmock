import { describe, expect, test } from "bun:test";

import { selectDependabotPullRequests } from "./security-items";

describe("selectDependabotPullRequests", () => {
  test("PL-19.5 lists only Dependabot's open pull requests", () => {
    expect(
      selectDependabotPullRequests([
        {
          number: 327,
          title: "chore: bump the github-actions group",
          user: { login: "dependabot[bot]" },
        },
        {
          number: 331,
          title: "fix: build setup salts from the random source",
          user: { login: "shibbirweb" },
        },
      ]),
    ).toEqual(["#327 chore: bump the github-actions group"]);
  });
});
