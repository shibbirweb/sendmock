import type { ReleaseChannel } from "@/lib/api/types";

/** One entry of GitHub Releases, as the update check reads it. */
export type PublishedRelease = {
  version: string;
  publishedAt: string;
  isPrerelease: boolean;
  releaseNotesMarkdown: string;
};

type ParsedVersion = {
  coreNumbers: [number, number, number];
  /** `beta.2` becomes ["beta", 2]; empty for a stable version. */
  prereleaseParts: (string | number)[];
};

function parseVersion(version: string): ParsedVersion | null {
  const versionMatch = version
    .replace(/^v/, "")
    .match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (versionMatch === null) {
    return null;
  }

  return {
    coreNumbers: [
      Number(versionMatch[1]),
      Number(versionMatch[2]),
      Number(versionMatch[3]),
    ],
    prereleaseParts: (versionMatch[4] ?? "")
      .split(".")
      .filter((prereleasePart) => prereleasePart !== "")
      .map((prereleasePart) =>
        /^\d+$/.test(prereleasePart) ? Number(prereleasePart) : prereleasePart,
      ),
  };
}

function comparePrereleaseParts(
  leftParts: (string | number)[],
  rightParts: (string | number)[],
): number {
  // A stable version is newer than any prerelease of the same core version.
  if (leftParts.length === 0 || rightParts.length === 0) {
    return rightParts.length - leftParts.length;
  }
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
    const leftPart = leftParts[i];
    const rightPart = rightParts[i];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === undefined ? -1 : 1;
    }
    if (leftPart !== rightPart) {
      if (typeof leftPart === "number" && typeof rightPart === "number") {
        return leftPart - rightPart;
      }

      return String(leftPart) < String(rightPart) ? -1 : 1;
    }
  }

  return 0;
}

/** Semantic version order: negative when `leftVersion` is older, 0 when equal. */
export function compareVersions(
  leftVersion: string,
  rightVersion: string,
): number {
  const leftParsed = parseVersion(leftVersion);
  const rightParsed = parseVersion(rightVersion);
  if (leftParsed === null || rightParsed === null) {
    return 0;
  }
  for (let i = 0; i < 3; i++) {
    const coreDifference =
      (leftParsed.coreNumbers[i] ?? 0) - (rightParsed.coreNumbers[i] ?? 0);
    if (coreDifference !== 0) {
      return coreDifference;
    }
  }

  return comparePrereleaseParts(
    leftParsed.prereleaseParts,
    rightParsed.prereleaseParts,
  );
}

/** Edge and dev builds are offered nothing (PL-05.12). */
export function isChannelChecked(releaseChannel: ReleaseChannel): boolean {
  return releaseChannel === "stable" || releaseChannel === "beta";
}

/**
 * The release an update check offers (PL-05.12): stable installs get the
 * newest stable, beta installs the newer of the newest beta and the newest
 * stable, and only when it is newer than the running version.
 */
export function selectOfferedRelease({
  currentVersion,
  releaseChannel,
  publishedReleases,
}: {
  currentVersion: string;
  releaseChannel: ReleaseChannel;
  publishedReleases: PublishedRelease[];
}): PublishedRelease | null {
  if (!isChannelChecked(releaseChannel)) {
    return null;
  }
  const offeredReleases = publishedReleases.filter(
    (publishedRelease) =>
      releaseChannel === "beta" || !publishedRelease.isPrerelease,
  );
  const newestRelease = offeredReleases.reduce<PublishedRelease | null>(
    (newestSoFar, publishedRelease) =>
      newestSoFar === null ||
      compareVersions(publishedRelease.version, newestSoFar.version) > 0
        ? publishedRelease
        : newestSoFar,
    null,
  );

  return newestRelease !== null &&
    compareVersions(newestRelease.version, currentVersion) > 0
    ? newestRelease
    : null;
}
