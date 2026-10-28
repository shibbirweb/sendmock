export type ChangelogEntry = { text: string; pullRequestNumber: number | null };
export type ChangelogGroup = { heading: string; entries: ChangelogEntry[] };
export type ChangelogRelease = {
  version: string;
  releaseDate: string;
  groups: ChangelogGroup[];
};

const releaseHeadingPattern = /^## (\S+) - (\d{4}-\d{2}-\d{2})$/;
const entryPattern = /^- (.*?)(?: \(#(\d+)\))?$/;

/** Reads `CHANGELOG.md` as the Prepare release workflow writes it, newest release first. */
export function parseChangelog(changelogMarkdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  for (const line of changelogMarkdown.split("\n")) {
    const releaseHeading = line.match(releaseHeadingPattern);
    if (releaseHeading) {
      releases.push({
        version: releaseHeading[1] ?? "",
        releaseDate: releaseHeading[2] ?? "",
        groups: [],
      });
      continue;
    }
    const currentRelease = releases.at(-1);
    if (!currentRelease) {
      continue;
    }
    if (line.startsWith("### ")) {
      currentRelease.groups.push({ heading: line.slice(4), entries: [] });
      continue;
    }
    const entry = line.match(entryPattern);
    const currentGroup = currentRelease.groups.at(-1);
    if (entry && currentGroup) {
      currentGroup.entries.push({
        text: entry[1] ?? "",
        pullRequestNumber: entry[2] ? Number(entry[2]) : null,
      });
    }
  }
  return releases;
}
