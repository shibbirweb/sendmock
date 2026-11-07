import type { MergedPullRequest } from "./change-kind";
import {
  compareVersions,
  formatVersion,
  isBeta,
  parseVersion,
  type SemanticVersion,
} from "./semantic-version";

export const firstVersion: SemanticVersion = {
  major: 0,
  minor: 0,
  patch: 0,
  betaNumber: null,
};

function runGit(gitArguments: string[], repositoryRoot: string): string {
  const gitResult = Bun.spawnSync(["git", ...gitArguments], {
    cwd: repositoryRoot,
  });
  if (gitResult.exitCode !== 0) {
    throw new Error(
      `git ${gitArguments.join(" ")} failed: ${gitResult.stderr.toString()}`,
    );
  }
  return gitResult.stdout.toString();
}

/** Release tags (`v0.4.0-beta.2`) reachable from HEAD, oldest first. */
export function readReleaseTags(repositoryRoot: string): SemanticVersion[] {
  return runGit(["tag", "--list", "v*", "--merged", "HEAD"], repositoryRoot)
    .split("\n")
    .map((tagName) => parseVersion(tagName))
    .filter((version): version is SemanticVersion => version !== null)
    .sort(compareVersions);
}

export function findLastStable(tags: SemanticVersion[]): SemanticVersion {
  return tags.filter((tag) => !isBeta(tag)).at(-1) ?? firstVersion;
}

/**
 * Where a changelog section starts: a stable collects everything since the last stable,
 * so its readers need no beta sections; a beta starts at the last tag of any kind.
 */
export function findSectionStartTag(
  sectionVersion: SemanticVersion,
  tags: SemanticVersion[],
): SemanticVersion | null {
  const olderTags = tags.filter(
    (tag) => compareVersions(tag, sectionVersion) < 0,
  );
  const candidateTags = isBeta(sectionVersion)
    ? olderTags
    : olderTags.filter((tag) => !isBeta(tag));
  return candidateTags.at(-1) ?? null;
}

/** `Merge pull request #47 from ...` commits, with the title from the commit body. */
export function parseMergeCommits(gitLogOutput: string): MergedPullRequest[] {
  return gitLogOutput
    .split("\u001e")
    .map((commitText) => commitText.trim())
    .flatMap((commitText) => {
      const [subject = "", body = ""] = commitText.split("\u001f");
      const pullRequestNumber = subject.match(
        /^Merge pull request #(\d+)/,
      )?.[1];
      const title = body
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line !== "");
      return pullRequestNumber && title
        ? [{ number: Number(pullRequestNumber), title }]
        : [];
    });
}

export function readMergedPullRequestsSince(
  startTag: SemanticVersion | null,
  repositoryRoot: string,
): MergedPullRequest[] {
  const revisionRange =
    startTag === null ? "HEAD" : `v${formatVersion(startTag)}..HEAD`;
  return parseMergeCommits(
    runGit(
      ["log", revisionRange, "--merges", "--format=%s%x1f%b%x1e"],
      repositoryRoot,
    ),
  );
}
