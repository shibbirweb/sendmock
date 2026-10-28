import { describe, expect, test } from "bun:test";

import {
  decidePublication,
  findNextReleaseNumber,
  findReleaseBlockers,
  findVersionMismatches,
} from "./release-decisions";

describe("decidePublication", () => {
  test("DS-04.1 publishes an untagged beta from develop", () => {
    expect(decidePublication("beta-publish", "0.1.0-beta.1", [])).toEqual({
      shouldAct: true,
      version: "0.1.0-beta.1",
      tagName: "v0.1.0-beta.1",
    });
  });

  test("DS-04.3 promotes and then publishes an untagged stable", () => {
    expect(
      decidePublication("stable-promote", "0.4.0", ["v0.4.0-beta.2"]).shouldAct,
    ).toBe(true);
    expect(
      decidePublication("stable-publish", "0.4.0", ["v0.4.0-beta.2"]).shouldAct,
    ).toBe(true);
  });

  test("DS-04.5 does nothing for a version that is already tagged, so a re-run is safe", () => {
    expect(
      decidePublication("beta-publish", "0.1.0-beta.1", ["v0.1.0-beta.1"]),
    ).toEqual({
      shouldAct: false,
      reason: "v0.1.0-beta.1 is already published",
    });
  });

  test("leaves a stable to the stable workflows and a beta to the beta one", () => {
    expect(decidePublication("beta-publish", "0.4.0", []).shouldAct).toBe(
      false,
    );
    expect(
      decidePublication("stable-publish", "0.4.0-beta.1", []).shouldAct,
    ).toBe(false);
  });
});

describe("findReleaseBlockers", () => {
  test("DS-04.4 refuses a release from a commit where CI did not pass", () => {
    expect(
      findReleaseBlockers({
        ciConclusion: "failure",
        openReleasePullRequestNumbers: [],
      }),
    ).toHaveLength(1);
    expect(
      findReleaseBlockers({
        ciConclusion: null,
        openReleasePullRequestNumbers: [],
      }),
    ).toHaveLength(1);
  });

  test("refuses while another release pull request is open", () => {
    expect(
      findReleaseBlockers({
        ciConclusion: "success",
        openReleasePullRequestNumbers: [61],
      }),
    ).toEqual([
      "Release pull request #61 is still open; merge or close it first.",
    ]);
  });

  test("allows a release from a passing commit with nothing in progress", () => {
    expect(
      findReleaseBlockers({
        ciConclusion: "success",
        openReleasePullRequestNumbers: [],
      }),
    ).toEqual([]);
  });
});

describe("findVersionMismatches", () => {
  test("DS-04.4 the version in code, the tag and the pre-release flag agree", () => {
    expect(
      findVersionMismatches("0.1.0-beta.1", "v0.1.0-beta.1", true),
    ).toEqual([]);
    expect(findVersionMismatches("1.0.0", "v1.0.0", false)).toEqual([]);
  });

  test("DS-04.4 names a tag or pre-release flag that disagrees with the code", () => {
    expect(
      findVersionMismatches("0.1.0-beta.1", "v0.1.0-beta.2", true),
    ).toHaveLength(1);
    expect(findVersionMismatches("1.0.0", "v1.0.0", true)).toHaveLength(1);
  });
});

describe("findNextReleaseNumber", () => {
  test("counts the releases so far", () => {
    expect(findNextReleaseNumber([])).toBe(1);
    expect(
      findNextReleaseNumber(["v0.1.0-beta.1", "v0.1.0-beta.2", "beta"]),
    ).toBe(3);
  });
});
