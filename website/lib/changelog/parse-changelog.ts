export type ChangelogEntry = { text: string; pullRequestNumber: number | null };
export type ChangelogGroup = { heading: string; entries: ChangelogEntry[] };
export type ChangelogRelease = {
  /** `Unreleased` for what the newest beta holds, else the version. */
  version: string;
  /** Empty for `Unreleased`. */
  releaseDate: string;
  groups: ChangelogGroup[];
};

export const unreleasedVersion = "Unreleased";

const unreleasedHeadingPattern = /^## \[Unreleased\]\s*$/;
const releaseHeadingPattern = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/;
const entryPattern = /^- (.*?)(?: \(#(\d+)\))?$/;

function readSectionHeading(line: string): ChangelogRelease | null {
  if (unreleasedHeadingPattern.test(line)) {
    return { version: unreleasedVersion, releaseDate: "", groups: [] };
  }
  const releaseHeading = line.match(releaseHeadingPattern);
  return releaseHeading
    ? {
        version: releaseHeading[1] ?? "",
        releaseDate: releaseHeading[2] ?? "",
        groups: [],
      }
    : null;
}

/**
 * Reads `CHANGELOG.md` in Keep a Changelog form, newest first: `[Unreleased]` (what the newest
 * beta holds) and then each dated release. A section with no entries is left out.
 */
export function parseChangelog(changelogMarkdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  for (const line of changelogMarkdown.replaceAll("\r\n", "\n").split("\n")) {
    const sectionHeading = readSectionHeading(line);
    if (sectionHeading) {
      releases.push(sectionHeading);
      continue;
    }
    if (line.startsWith("## ")) {
      releases.push({ version: "", releaseDate: "", groups: [] });
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
  return releases.filter(
    (release) =>
      release.version !== "" &&
      release.groups.some((group) => group.entries.length > 0),
  );
}
