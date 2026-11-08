/**
 * `CHANGELOG.md` in Keep a Changelog form (docs/plan/16-website-and-releases.md, The
 * changelog): every user-visible change adds a line under `## [Unreleased]` by hand, a beta's
 * notes are that section as it is, and a stable release dates it into `## [x.y.z] - date`.
 */

const unreleasedHeading = "## [Unreleased]";

function isBetaVersion(version: string): boolean {
  return version.includes("-beta.");
}

/** The heading line a section starts with: `## [Unreleased]` or `## [0.4.0] - 2026-11-09`. */
function findSectionHeadingIndex(
  changelogLines: string[],
  sectionLabel: string,
): number {
  return sectionLabel === "Unreleased"
    ? changelogLines.findIndex((line) => line.trim() === unreleasedHeading)
    : changelogLines.findIndex((line) =>
        line.startsWith(`## [${sectionLabel}] - `),
      );
}

/**
 * A section's body without its heading, trimmed; null when there is no such section. Pass
 * no version for `[Unreleased]`. Link reference lines (`[0.4.0]: https://...`) are left out.
 */
export function readChangelogSection(
  changelog: string,
  version?: string,
): string | null {
  const changelogLines = changelog.replaceAll("\r\n", "\n").split("\n");
  const headingIndex = findSectionHeadingIndex(
    changelogLines,
    version ?? "Unreleased",
  );
  if (headingIndex === -1) {
    return null;
  }
  const nextHeadingOffset = changelogLines
    .slice(headingIndex + 1)
    .findIndex((line) => line.startsWith("## "));
  const sectionEnd =
    nextHeadingOffset === -1
      ? changelogLines.length
      : headingIndex + 1 + nextHeadingOffset;
  return changelogLines
    .slice(headingIndex + 1, sectionEnd)
    .filter((line) => !/^\[[^\]]+\]:\s*\S+/.test(line))
    .join("\n")
    .trim();
}

/** Whether `[Unreleased]` holds at least one entry, which every release needs. */
export function hasUnreleasedEntries(changelog: string): boolean {
  return (readChangelogSection(changelog) ?? "")
    .split("\n")
    .some((line) => line.startsWith("- "));
}

/**
 * A release's notes, the GitHub release body word for word (DS-05.5): a beta's are the
 * `[Unreleased]` section at its release commit, a stable's its dated section.
 */
export function extractReleaseNotes(
  changelog: string,
  version: string,
): string | null {
  return isBetaVersion(version)
    ? readChangelogSection(changelog)
    : readChangelogSection(changelog, version);
}

/**
 * Dates the changelog for a stable release: `## [Unreleased]` becomes `## [x.y.z] - date`,
 * with a fresh empty `## [Unreleased]` above it.
 */
export function dateUnreleasedSection(
  changelog: string,
  version: string,
  releaseDate: string,
): string {
  return changelog.replace(
    unreleasedHeading,
    `${unreleasedHeading}\n\n## [${version}] - ${releaseDate}`,
  );
}

/**
 * Prepares `CHANGELOG.md` for a release of `version`: a beta needs entries under
 * `[Unreleased]` and changes nothing; a stable needs them too and gets its dated section.
 * Answers the new file text, or why the release is refused.
 */
export function prepareChangelogForRelease(
  changelog: string,
  version: string,
  releaseDate: string,
): { changelog: string } | { refusal: string } {
  if (!changelog.includes(unreleasedHeading)) {
    return {
      refusal: `CHANGELOG.md has no ${unreleasedHeading} section to take the release notes from.`,
    };
  }
  if (!hasUnreleasedEntries(changelog)) {
    return {
      refusal:
        "CHANGELOG.md has nothing under [Unreleased]. Describe what the release holds there first, merge that, and run Prepare release again.",
    };
  }
  if (isBetaVersion(version)) {
    return { changelog };
  }
  if (readChangelogSection(changelog, version) !== null) {
    return {
      refusal: `CHANGELOG.md already has a [${version}] section, so ${version} looks released already.`,
    };
  }
  return { changelog: dateUnreleasedSection(changelog, version, releaseDate) };
}
