import { describe, expect, test } from "bun:test";

import type { ChangeKind } from "./change-kind";
import {
  computeNextVersion,
  type ReleaseBump,
  type ReleaseState,
} from "./next-version";
import { formatVersion, parseVersion } from "./semantic-version";

function releaseState(
  currentVersion: string,
  changeKinds: ChangeKind[],
  isCurrentVersionTagged = true,
): ReleaseState {
  return {
    currentVersion: parseVersion(currentVersion) ?? {
      major: 0,
      minor: 0,
      patch: 0,
      betaNumber: null,
    },
    lastStableVersion: parseVersion("0.3.1") ?? {
      major: 0,
      minor: 0,
      patch: 0,
      betaNumber: null,
    },
    isCurrentVersionTagged,
    changeKindsSinceLastTag: changeKinds,
  };
}

function next(bump: ReleaseBump, state: ReleaseState): string {
  const result = computeNextVersion(bump, state);
  return "version" in result
    ? formatVersion(result.version)
    : `refused: ${result.refusal}`;
}

describe("computeNextVersion from stable 0.3.1 (DS-05.3)", () => {
  test("DS-05.3 beta follows the merged changes: fix, feature or breaking", () => {
    expect(next("beta", releaseState("0.3.1", ["fix", "other"]))).toBe(
      "0.3.2-beta.1",
    );
    expect(next("beta", releaseState("0.3.1", ["fix", "feature"]))).toBe(
      "0.4.0-beta.1",
    );
    expect(next("beta", releaseState("0.3.1", ["feature", "breaking"]))).toBe(
      "1.0.0-beta.1",
    );
  });

  test("DS-05.3 patch, minor and major start the first beta of that version", () => {
    expect(next("patch", releaseState("0.3.1", []))).toBe("0.3.2-beta.1");
    expect(next("minor", releaseState("0.3.1", []))).toBe("0.4.0-beta.1");
    expect(next("major", releaseState("0.3.1", []))).toBe("1.0.0-beta.1");
  });

  test("DS-05.3 stable is refused without a beta to finish", () => {
    expect(next("stable", releaseState("0.3.1", ["feature"]))).toStartWith(
      "refused:",
    );
  });

  test("beta is refused when nothing user-facing was merged", () => {
    expect(next("beta", releaseState("0.3.1", ["other"]))).toStartWith(
      "refused: Nothing to release",
    );
  });
});

describe("computeNextVersion from beta 0.4.0-beta.2 (DS-05.3)", () => {
  test("DS-05.3 beta makes the next beta", () => {
    expect(next("beta", releaseState("0.4.0-beta.2", []))).toBe("0.4.0-beta.3");
  });

  test("DS-05.3 a version that is not newer than the one in progress is refused", () => {
    expect(next("patch", releaseState("0.4.0-beta.2", []))).toStartWith(
      "refused:",
    );
    expect(next("minor", releaseState("0.4.0-beta.2", []))).toStartWith(
      "refused:",
    );
  });

  test("DS-05.3 major leaves the 0.4 betas behind", () => {
    expect(next("major", releaseState("0.4.0-beta.2", []))).toBe(
      "1.0.0-beta.1",
    );
  });

  test("DS-05.3 stable finishes a published beta with only maintenance on top", () => {
    expect(next("stable", releaseState("0.4.0-beta.2", ["other"]))).toBe(
      "0.4.0",
    );
  });

  test("DS-04.2 DS-05.3 stable is refused with untried changes on top of its beta", () => {
    expect(next("stable", releaseState("0.4.0-beta.2", ["fix"]))).toStartWith(
      "refused: Features or fixes",
    );
  });

  test("DS-04.2 stable is refused while the beta is unpublished", () => {
    expect(next("stable", releaseState("0.4.0-beta.2", [], false))).toStartWith(
      "refused:",
    );
  });
});

describe("the first release", () => {
  test("minor from 0.0.0 makes 0.1.0-beta.1", () => {
    const state = {
      ...releaseState("0.0.0", []),
      lastStableVersion: { major: 0, minor: 0, patch: 0, betaNumber: null },
    };

    expect(next("minor", state)).toBe("0.1.0-beta.1");
  });
});
