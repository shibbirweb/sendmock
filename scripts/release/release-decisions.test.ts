import { describe, expect, test } from "bun:test";

import { computeNextVersion } from "../version/next-version";
import { formatVersion, parseVersion } from "../version/semantic-version";
import {
  decideDockerTags,
  decidePublication,
  findNextReleaseNumber,
  findReleaseBlockers,
  findReleaseBodyDifferences,
  findVersionMismatches,
  planPromotePullRequest,
  planReleasePullRequest,
  readReleaseBody,
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

  test("never publishes the 0.0.0 the code carries before the first release", () => {
    expect(decidePublication("stable-promote", "0.0.0", []).shouldAct).toBe(
      false,
    );
    expect(decidePublication("stable-publish", "0.0.0", []).shouldAct).toBe(
      false,
    );
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

describe("decideDockerTags", () => {
  test("DS-02.4 a stable pushes latest, the version, major.minor and major", () => {
    expect(decideDockerTags("1.4.2", "stable")).toEqual([
      "latest",
      "1.4.2",
      "1.4",
      "1",
    ]);
    expect(decideDockerTags("0.3.0", "stable")).toEqual([
      "latest",
      "0.3.0",
      "0.3",
      "0",
    ]);
  });

  test("DS-02.4 a beta pushes beta and its version", () => {
    expect(decideDockerTags("1.5.0-beta.2", "beta")).toEqual([
      "beta",
      "1.5.0-beta.2",
    ]);
  });

  test("refuses a version that does not fit the channel", () => {
    expect(() => decideDockerTags("1.5.0-beta.2", "stable")).toThrow();
    expect(() => decideDockerTags("1.5.0", "beta")).toThrow();
    expect(() => decideDockerTags("1.5.0", "dev")).toThrow();
    expect(() => decideDockerTags("next", "stable")).toThrow();
  });
});

describe("release bodies", () => {
  const changelogFile = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "### Added",
    "",
    "- Webhook replay from the delivery log.",
    "",
    "## [0.2.0] - 2026-11-09",
    "",
    "### Added",
    "",
    "- SMS threads.",
    "- Webhook replay.",
    "",
    "### Fixed",
    "",
    "- Retry timing.",
    "",
  ].join("\n");

  test("DS-05.5 a beta's body is the [Unreleased] section without its heading", () => {
    expect(readReleaseBody(changelogFile, "0.3.0-beta.1")).toBe(
      "### Added\n\n- Webhook replay from the delivery log.",
    );
  });

  test("DS-05.5 a stable's body is its dated section", () => {
    expect(readReleaseBody(changelogFile, "0.2.0")).toBe(
      "### Added\n\n- SMS threads.\n- Webhook replay.\n\n### Fixed\n\n- Retry timing.",
    );
  });

  test("DS-05.5 a version without a section is refused", () => {
    expect(() => readReleaseBody(changelogFile, "0.3.0")).toThrow(
      "CHANGELOG.md has no section for 0.3.0",
    );
  });

  test("DS-05.5 a published body matches its section word for word, line endings aside", () => {
    const releaseBody = readReleaseBody(changelogFile, "0.2.0");

    expect(
      findReleaseBodyDifferences(
        releaseBody,
        `${releaseBody.replaceAll("\n", "\r\n")}\r\n`,
      ),
    ).toEqual([]);
    expect(
      findReleaseBodyDifferences(
        releaseBody,
        releaseBody.replace("Webhook replay", "Replay"),
      ),
    ).toEqual([
      'line 4: expected "- Webhook replay.", published "- Replay."',
    ]);
    expect(findReleaseBodyDifferences("### Added", "")).toEqual([
      'line 1: expected "### Added", published ""',
    ]);
  });
});

describe("release pull requests from a release history (dry run)", () => {
  test("DS-04.1 a beta bump opens the release pull request into develop, and merging it publishes the pre-release", () => {
    const releaseTags = ["v0.1.0", "v0.2.0-beta.1"];
    const nextVersionResult = computeNextVersion("beta", {
      currentVersion: parseVersion("0.2.0-beta.1") ?? failToParse(),
      lastStableVersion: parseVersion("0.1.0") ?? failToParse(),
      isCurrentVersionTagged: true,
      changeKindsSinceLastTag: ["feature"],
    });
    const nextVersion =
      "version" in nextVersionResult
        ? formatVersion(nextVersionResult.version)
        : failToParse();

    expect(nextVersion).toBe("0.2.0-beta.2");
    expect(
      planReleasePullRequest(nextVersion, findNextReleaseNumber(releaseTags)),
    ).toEqual({
      title: "chore:[REL-3] release 0.2.0-beta.2",
      base: "develop",
      head: "release/v0.2.0-beta.2",
    });
    expect(decidePublication("beta-publish", nextVersion, releaseTags)).toEqual(
      {
        shouldAct: true,
        version: "0.2.0-beta.2",
        tagName: "v0.2.0-beta.2",
      },
    );
  });

  test("DS-04.3 a stable on develop opens the develop to main pull request, and merging it publishes the stable", () => {
    const releaseTags = ["v0.1.0", "v0.2.0-beta.1", "v0.2.0-beta.2"];

    expect(
      decidePublication("stable-promote", "0.2.0", releaseTags).shouldAct,
    ).toBe(true);
    expect(
      planPromotePullRequest("0.2.0", findNextReleaseNumber(releaseTags)),
    ).toEqual({
      title: "chore:[REL-4] promote 0.2.0 to main",
      base: "main",
      head: "develop",
    });
    expect(decidePublication("stable-publish", "0.2.0", releaseTags)).toEqual({
      shouldAct: true,
      version: "0.2.0",
      tagName: "v0.2.0",
    });
    expect(
      decidePublication("stable-publish", "0.2.0", [...releaseTags, "v0.2.0"])
        .shouldAct,
    ).toBe(false);
  });
});

function failToParse(): never {
  throw new Error("not a version");
}
