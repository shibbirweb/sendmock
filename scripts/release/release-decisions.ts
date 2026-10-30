import {
  formatVersion,
  isBeta,
  parseVersion,
} from "../version/semantic-version";

/** The version the code carries before the first Prepare release run. */
const unreleasedVersion = "0.0.0";

export type PublicationWorkflow =
  "beta-publish" | "stable-promote" | "stable-publish";

export type PublicationDecision =
  | { shouldAct: true; version: string; tagName: string }
  | { shouldAct: false; reason: string };

/**
 * Whether a publish workflow has work to do for the version in the code. A version that is
 * already tagged needs nothing, so every workflow can be re-run safely.
 */
export function decidePublication(
  publicationWorkflow: PublicationWorkflow,
  versionInCode: string,
  existingTagNames: string[],
): PublicationDecision {
  const version = parseVersion(versionInCode);
  if (!version) {
    return { shouldAct: false, reason: `${versionInCode} is not a version` };
  }
  const tagName = `v${formatVersion(version)}`;
  if (formatVersion(version) === unreleasedVersion) {
    return {
      shouldAct: false,
      reason: "No release has been prepared yet; run Prepare release.",
    };
  }
  if (existingTagNames.includes(tagName)) {
    return { shouldAct: false, reason: `${tagName} is already published` };
  }
  const isWorkflowForBetas = publicationWorkflow === "beta-publish";
  if (isBeta(version) !== isWorkflowForBetas) {
    return {
      shouldAct: false,
      reason: `${tagName} is ${isBeta(version) ? "a beta" : "a stable"} version`,
    };
  }
  return { shouldAct: true, version: formatVersion(version), tagName };
}

export type ReleaseReadiness = {
  ciConclusion: string | null;
  openReleasePullRequestNumbers: number[];
};

/** Why a release may not start now: CI did not pass, or another release is under way. */
export function findReleaseBlockers(readiness: ReleaseReadiness): string[] {
  const releaseBlockers: string[] = [];
  if (readiness.ciConclusion !== "success") {
    releaseBlockers.push(
      `CI on this commit is ${readiness.ciConclusion ?? "missing"}; a release needs a passing run.`,
    );
  }
  for (const pullRequestNumber of readiness.openReleasePullRequestNumbers) {
    releaseBlockers.push(
      `Release pull request #${pullRequestNumber} is still open; merge or close it first.`,
    );
  }
  return releaseBlockers;
}

/** The version in the code, the tag and the pre-release flag must all say the same thing. */
export function findVersionMismatches(
  versionInCode: string,
  tagName: string,
  isPrerelease: boolean,
): string[] {
  const version = parseVersion(versionInCode);
  if (!version) {
    return [`${versionInCode} is not a version`];
  }
  const versionMismatches: string[] = [];
  if (tagName !== `v${formatVersion(version)}`) {
    versionMismatches.push(
      `The tag ${tagName} does not match the version in the code, ${versionInCode}.`,
    );
  }
  if (isPrerelease !== isBeta(version)) {
    versionMismatches.push(
      `${versionInCode} is ${isBeta(version) ? "a beta" : "a stable"}, but the release is ${isPrerelease ? "" : "not "}marked as a pre-release.`,
    );
  }
  return versionMismatches;
}

/** The `REL-N` ticket of the next release commit: one more than the releases so far. */
export function findNextReleaseNumber(existingTagNames: string[]): number {
  return (
    existingTagNames.filter((tagName) => parseVersion(tagName) !== null)
      .length + 1
  );
}
