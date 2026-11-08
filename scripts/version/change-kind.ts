/** What a merged pull request means for the version and the changelog, read from its title. */
export type ChangeKind = "breaking" | "feature" | "fix" | "other";

export type MergedPullRequest = { number: number; title: string };

const releaseNotePrefixPattern = /^(feat|fix)(!)?:(?:\[[^\]]*\])?\s*/;

export function classifyChange(pullRequestTitle: string): ChangeKind {
  const prefixMatch = pullRequestTitle.match(releaseNotePrefixPattern);
  if (!prefixMatch) {
    return "other";
  }
  if (prefixMatch[2] === "!") {
    return "breaking";
  }
  return prefixMatch[1] === "feat" ? "feature" : "fix";
}
