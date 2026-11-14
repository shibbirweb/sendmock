import type { ChangeKind } from "./change-kind";
import {
  compareVersions,
  formatVersion,
  isBeta,
  type SemanticVersion,
  toReleaseVersion,
} from "./semantic-version";

export type ReleaseBump = "beta" | "patch" | "minor" | "major" | "stable";
export const releaseBumps: ReleaseBump[] = [
  "beta",
  "patch",
  "minor",
  "major",
  "stable",
];

export type ReleaseState = {
  currentVersion: SemanticVersion;
  lastStableVersion: SemanticVersion;
  isCurrentVersionTagged: boolean;
  /** Changes merged since the last tag of any kind. */
  changeKindsSinceLastTag: ChangeKind[];
};

export type NextVersionResult =
  { version: SemanticVersion } | { refusal: string };

function firstBeta(
  release: Omit<SemanticVersion, "betaNumber">,
): SemanticVersion {
  return { ...release, betaNumber: 1 };
}

function bumpRelease(
  base: SemanticVersion,
  bump: "patch" | "minor" | "major",
): SemanticVersion {
  if (bump === "major") {
    return firstBeta({ major: base.major + 1, minor: 0, patch: 0 });
  }
  if (bump === "minor") {
    return firstBeta({ major: base.major, minor: base.minor + 1, patch: 0 });
  }
  return firstBeta({
    major: base.major,
    minor: base.minor,
    patch: base.patch + 1,
  });
}

/** The bump the merged changes call for: breaking is major, a feature minor, a fix patch. */
function bumpForChanges(
  changeKinds: ChangeKind[],
): "patch" | "minor" | "major" | null {
  if (changeKinds.includes("breaking")) {
    return "major";
  }
  if (changeKinds.includes("feature")) {
    return "minor";
  }
  return changeKinds.includes("fix") ? "patch" : null;
}

function nextStable(releaseState: ReleaseState): NextVersionResult {
  const { currentVersion } = releaseState;
  if (!isBeta(currentVersion)) {
    return { refusal: "There is no beta to finish; make a beta first." };
  }
  if (!releaseState.isCurrentVersionTagged) {
    return {
      refusal: `${formatVersion(currentVersion)} is not published yet; publish the beta before making it stable.`,
    };
  }
  if (bumpForChanges(releaseState.changeKindsSinceLastTag) !== null) {
    return {
      refusal: `Features or fixes landed after ${formatVersion(currentVersion)}; release them in a beta first.`,
    };
  }
  return { version: toReleaseVersion(currentVersion) };
}

/** Works out the next version from the bump choice, as the table in plan 16 says. */
export function computeNextVersion(
  bump: ReleaseBump,
  releaseState: ReleaseState,
): NextVersionResult {
  const { currentVersion, lastStableVersion } = releaseState;
  if (bump === "stable") {
    return nextStable(releaseState);
  }
  if (bump === "beta" && isBeta(currentVersion)) {
    return {
      version: {
        ...currentVersion,
        betaNumber: (currentVersion.betaNumber ?? 0) + 1,
      },
    };
  }
  const releaseBump =
    bump === "beta"
      ? bumpForChanges(releaseState.changeKindsSinceLastTag)
      : bump;
  if (releaseBump === null) {
    return { refusal: "Nothing to release: no feature or fix was merged." };
  }
  const candidate = bumpRelease(lastStableVersion, releaseBump);
  if (
    isBeta(currentVersion) &&
    compareVersions(
      toReleaseVersion(candidate),
      toReleaseVersion(currentVersion),
    ) <= 0
  ) {
    return {
      refusal: `${formatVersion(toReleaseVersion(candidate))} is not newer than ${formatVersion(toReleaseVersion(currentVersion))}, which is already in progress.`,
    };
  }
  return { version: candidate };
}
