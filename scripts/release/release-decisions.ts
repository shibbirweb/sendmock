import { extractReleaseNotes } from "../version/changelog";
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

/**
 * The image tags a release pushes (DS-02.4): a beta is `beta` and its version, a stable is
 * `latest`, its version, `major.minor` and `major`. The workflow adds a `-debug` twin of each.
 */
export function decideDockerTags(version: string, channel: string): string[] {
  const parsedVersion = parseVersion(version);
  if (parsedVersion === null) {
    throw new Error(`${version} is not a release version`);
  }
  if (channel === "beta") {
    if (!isBeta(parsedVersion)) {
      throw new Error(
        `a beta release carries a -beta.N version, not ${version}`,
      );
    }
    return ["beta", version];
  }
  if (channel !== "stable" || isBeta(parsedVersion)) {
    throw new Error(`no image tags for ${version} on the ${channel} channel`);
  }
  const { major, minor } = parsedVersion;
  return ["latest", version, `${major}.${minor}`, `${major}`];
}

/**
 * A release's body: its `CHANGELOG.md` section without the heading, word for word (DS-05.5).
 * A version without a section is refused, so no release goes out with an empty body.
 */
export function readReleaseBody(changelog: string, version: string): string {
  const releaseNotes = extractReleaseNotes(changelog, version);
  if (releaseNotes === null) {
    throw new Error(
      `CHANGELOG.md has no section for ${version}; Prepare release writes it.`,
    );
  }
  return releaseNotes;
}

function normalizeBodyLines(body: string): string[] {
  return body
    .replaceAll("\r\n", "\n")
    .trim()
    .split("\n")
    .map((line) => line.trimEnd());
}

/** Where a published release body differs from its section, line by line (DS-05.5). */
export function findReleaseBodyDifferences(
  expectedBody: string,
  publishedBody: string,
): string[] {
  const expectedLines = normalizeBodyLines(expectedBody);
  const publishedLines = normalizeBodyLines(publishedBody);
  const lineCount = Math.max(expectedLines.length, publishedLines.length);
  const differences: string[] = [];
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const expectedLine = expectedLines[lineIndex] ?? "(no line)";
    const publishedLine = publishedLines[lineIndex] ?? "(no line)";
    if (expectedLine !== publishedLine) {
      differences.push(
        `line ${lineIndex + 1}: expected "${expectedLine}", published "${publishedLine}"`,
      );
    }
  }
  return differences;
}

export type ReleasePullRequest = { title: string; base: string; head: string };

/** The pull request Prepare release opens into `develop` with the version and its notes (DS-04.1). */
export function planReleasePullRequest(
  version: string,
  releaseNumber: number,
): ReleasePullRequest {
  return {
    title: `chore:[REL-${releaseNumber}] release ${version}`,
    base: "develop",
    head: `release/v${version}`,
  };
}

/** The pull request Promote stable opens from `develop` into `main` (DS-04.3). */
export function planPromotePullRequest(
  version: string,
  releaseNumber: number,
): ReleasePullRequest {
  return {
    title: `chore:[REL-${releaseNumber}] promote ${version} to main`,
    base: "main",
    head: "develop",
  };
}
