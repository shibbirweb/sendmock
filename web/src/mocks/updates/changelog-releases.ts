/** A stable release as `CHANGELOG.md` records it: Prepare release dates one `## [x.y.z] - YYYY-MM-DD` section per stable. */
export type ChangelogRelease = {
  version: string;
  releasedOn: string;
  notesMarkdown: string;
};

type OpenSection = {
  version: string;
  releasedOn: string;
  noteLines: string[];
};

const datedSectionHeading = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;

function closeSection(openSection: OpenSection): ChangelogRelease {
  return {
    version: openSection.version,
    releasedOn: openSection.releasedOn,
    notesMarkdown: openSection.noteLines.join("\n").trim(),
  };
}

/** The dated stable sections of `CHANGELOG.md`, newest first as the file lists them; `[Unreleased]` is left out. */
export function parseChangelogReleases(
  changelogMarkdown: string,
): ChangelogRelease[] {
  const changelogReleases: ChangelogRelease[] = [];
  let openSection: OpenSection | null = null;

  for (const changelogLine of changelogMarkdown.split("\n")) {
    const trimmedLine = changelogLine.trimEnd();
    if (!trimmedLine.startsWith("## ")) {
      openSection?.noteLines.push(trimmedLine);
      continue;
    }
    if (openSection !== null) {
      changelogReleases.push(closeSection(openSection));
    }
    const headingMatch = datedSectionHeading.exec(trimmedLine);
    openSection =
      headingMatch === null
        ? null
        : {
            version: headingMatch[1] ?? "",
            releasedOn: headingMatch[2] ?? "",
            noteLines: [],
          };
  }
  if (openSection !== null) {
    changelogReleases.push(closeSection(openSection));
  }

  return changelogReleases;
}
