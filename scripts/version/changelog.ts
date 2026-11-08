import {
  classifyChange,
  type MergedPullRequest,
  toReleaseNote,
} from "./change-kind";

export const changelogHeader = [
  "# Changelog",
  "",
  "Every SendMock release, newest first. The Prepare release workflow writes this file from the titles of the merged pull requests; do not edit it by hand.",
  "",
].join("\n");

const sectionGroups = [
  { changeKind: "breaking", heading: "Breaking changes" },
  { changeKind: "feature", heading: "Added" },
  { changeKind: "fix", heading: "Fixed" },
] as const;

/**
 * One release's section: the merged pull requests grouped into Breaking changes, Added
 * and Fixed, each line the title without prefix and ticket, with its PR linked.
 * `docs:`, `test:`, `chore:`, `ci:` and `refactor:` pull requests are left out.
 */
export function renderChangelogSection(
  version: string,
  releaseDate: string,
  mergedPullRequests: MergedPullRequest[],
): string {
  const groupBlocks = sectionGroups.flatMap(({ changeKind, heading }) => {
    const groupLines = mergedPullRequests
      .filter((pullRequest) => classifyChange(pullRequest.title) === changeKind)
      .sort((first, second) => first.number - second.number)
      .map(
        (pullRequest) =>
          `- ${toReleaseNote(pullRequest.title)} (#${pullRequest.number})`,
      );
    return groupLines.length === 0
      ? []
      : [`### ${heading}`, "", ...groupLines, ""];
  });
  const bodyLines =
    groupBlocks.length === 0
      ? ["Maintenance only: no user-facing changes.", ""]
      : groupBlocks;
  return [`## ${version} - ${releaseDate}`, "", ...bodyLines].join("\n");
}

/** Adds a section above the newest one, creating the file's header the first time. */
export function insertChangelogSection(
  existingChangelog: string | null,
  section: string,
): string {
  // A file with only its header (committed before the first release) has no section to keep.
  const firstSectionIndex = existingChangelog?.indexOf("\n## ") ?? -1;
  const previousSections =
    existingChangelog === null || firstSectionIndex === -1
      ? ""
      : existingChangelog.slice(firstSectionIndex);
  const trimmedPreviousSections = previousSections.trim();
  return [changelogHeader, section.trimEnd(), "", trimmedPreviousSections]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

/** A version's section without its heading: the GitHub release body, word for word. */
export function extractReleaseNotes(
  changelog: string,
  version: string,
): string | null {
  const sectionLines = changelog.split("\n");
  const headingIndex = sectionLines.findIndex((line) =>
    line.startsWith(`## ${version} - `),
  );
  if (headingIndex === -1) {
    return null;
  }
  const nextHeadingOffset = sectionLines
    .slice(headingIndex + 1)
    .findIndex((line) => line.startsWith("## "));
  const sectionEnd =
    nextHeadingOffset === -1
      ? sectionLines.length
      : headingIndex + 1 + nextHeadingOffset;
  return sectionLines
    .slice(headingIndex + 1, sectionEnd)
    .join("\n")
    .trim();
}
