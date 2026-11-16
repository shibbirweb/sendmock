import type { DocsVersionKind } from "@/lib/docs-versions";

import {
  type ChangelogEntry,
  type ChangelogRelease,
  unreleasedVersion,
} from "./parse-changelog";

/** The changelog group for what a user must change to upgrade (WS-14.3). */
export const upgradeNotesHeading = "Upgrade notes";

export type VersionUpgradeNotes = {
  version: string;
  entries: ChangelogEntry[];
};

/** The beta docs (and the Preview before the first stable) are built from develop. */
function isDevelopBuild(versionKind: DocsVersionKind | undefined): boolean {
  return versionKind === "next" || versionKind === "preview";
}

function readMinorVersion(version: string): string | null {
  const minorMatch = /^(\d+)\.(\d+)\./.exec(version);
  return minorMatch === null ? null : `${minorMatch[1]}.${minorMatch[2]}`;
}

/**
 * The releases a docs version is about, newest first. Each version is built
 * from its own CHANGELOG.md, whose newest dated release is that version, so a
 * stable or older version shows every release of its minor; develop's builds
 * show what the newest beta holds.
 */
export function selectVersionReleases(
  releases: ChangelogRelease[],
  versionKind: DocsVersionKind | undefined,
): ChangelogRelease[] {
  if (isDevelopBuild(versionKind)) {
    return releases.filter((release) => release.version === unreleasedVersion);
  }
  const datedReleases = releases.filter(
    (release) => release.version !== unreleasedVersion,
  );
  const newestMinor = readMinorVersion(datedReleases[0]?.version ?? "");
  if (newestMinor === null) {
    return [];
  }
  return datedReleases.filter(
    (release) => readMinorVersion(release.version) === newestMinor,
  );
}

/** The sidebar link's text: "What's new in v1.1", or the beta's. */
export function describeWhatsNewLabel(
  releases: ChangelogRelease[],
  versionKind: DocsVersionKind | undefined,
): string {
  if (isDevelopBuild(versionKind)) {
    return "What's new in the beta";
  }
  const versionReleases = selectVersionReleases(releases, versionKind);
  const newestMinor = readMinorVersion(versionReleases[0]?.version ?? "");
  return newestMinor === null ? "What's new" : `What's new in v${newestMinor}`;
}

/** The upgrade notes of the given releases, leaving out releases that have none. */
export function collectUpgradeNotes(
  releases: ChangelogRelease[],
): VersionUpgradeNotes[] {
  return releases.flatMap((release) => {
    const entries = release.groups
      .filter((group) => group.heading === upgradeNotesHeading)
      .flatMap((group) => group.entries);
    return entries.length === 0 ? [] : [{ version: release.version, entries }];
  });
}
