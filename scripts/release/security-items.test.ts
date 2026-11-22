import { describe, expect, test } from "bun:test";

import {
  releasedBranchAlertsPath,
  selectDependabotPullRequests,
} from "./security-items";

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

describe("code scanning alerts", () => {
  test("a release waits for the alerts open on develop, so it can ship the fix of one still open on main", () => {
    expect(releasedBranchAlertsPath).toContain("state=open");
    expect(releasedBranchAlertsPath).toContain("ref=refs/heads/develop");
  });
});
