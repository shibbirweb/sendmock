/** A SendMock version: `X.Y.Z` for a stable release, `X.Y.Z-beta.N` for a beta. */
export type SemanticVersion = {
  major: number;
  minor: number;
  patch: number;
  betaNumber: number | null;
};

const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

export function parseVersion(versionText: string): SemanticVersion | null {
  const versionMatch = versionText.trim().match(versionPattern);
  if (!versionMatch) {
    return null;
  }
  return {
    major: Number(versionMatch[1]),
    minor: Number(versionMatch[2]),
    patch: Number(versionMatch[3]),
    betaNumber: versionMatch[4] === undefined ? null : Number(versionMatch[4]),
  };
}

export function formatVersion(version: SemanticVersion): string {
  const releaseVersion = `${version.major}.${version.minor}.${version.patch}`;
  return version.betaNumber === null
    ? releaseVersion
    : `${releaseVersion}-beta.${version.betaNumber}`;
}

export function isBeta(version: SemanticVersion): boolean {
  return version.betaNumber !== null;
}

/** The release a version leads to: `0.4.0-beta.2` becomes `0.4.0`. */
export function toReleaseVersion(version: SemanticVersion): SemanticVersion {
  return { ...version, betaNumber: null };
}

/** Negative when `first` is older; a beta is older than its own release. */
export function compareVersions(
  first: SemanticVersion,
  second: SemanticVersion,
): number {
  const releaseDifference =
    first.major - second.major ||
    first.minor - second.minor ||
    first.patch - second.patch;
  if (releaseDifference !== 0) {
    return releaseDifference;
  }
  const firstBetaRank = first.betaNumber ?? Number.POSITIVE_INFINITY;
  const secondBetaRank = second.betaNumber ?? Number.POSITIVE_INFINITY;
  if (firstBetaRank === secondBetaRank) {
    return 0;
  }
  return firstBetaRank < secondBetaRank ? -1 : 1;
}
