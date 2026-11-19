import changelogMarkdown from "virtual:sendmock-changelog";
import webPackageJson from "../../../package.json?raw";

import type { InstallMethod, ReleaseChannel } from "@/lib/api/types";
import type { OperatingSystem } from "@/mocks/updates/build-upgrade-command";
import {
  type ChangelogRelease,
  parseChangelogReleases,
} from "@/mocks/updates/changelog-releases";
import type { PublishedRelease } from "@/mocks/updates/select-offered-release";

/** A pretend install the demo controls can switch between, for the update check. */
export type MockInstallProfile = {
  key: string;
  label: string;
  version: string;
  releaseChannel: ReleaseChannel;
  installMethod: InstallMethod;
  operatingSystem: OperatingSystem;
};

function readPackageVersion(packageJsonText: string): string {
  const packageVersion: unknown = (
    JSON.parse(packageJsonText) as { version?: unknown }
  ).version;

  return typeof packageVersion === "string" ? packageVersion : "0.0.0-dev";
}

/** The version this demo was built as: `web/package.json`, which the release workflows bump. */
export const builtAppVersion = readPackageVersion(webPackageJson);

/** The stable releases the demo's pretend GitHub lists: the dated sections of `CHANGELOG.md`, so they are real. */
export const mockStableReleases: ChangelogRelease[] =
  parseChangelogReleases(changelogMarkdown);

const firstStableRelease: ChangelogRelease = {
  version: "1.0.0",
  releasedOn: "2026-11-14",
  notesMarkdown: "",
};
const latestStableRelease = mockStableReleases[0] ?? firstStableRelease;
/** Older installs run the stable before the latest, so the update check has the latest to offer. */
const previousStableVersion =
  mockStableReleases[1]?.version ?? latestStableRelease.version;
/** Every stable goes through a first beta, so this beta exists. */
const latestStableFirstBetaVersion = `${latestStableRelease.version}-beta.1`;

function toNextMinorEdgeVersion(stableVersion: string): string {
  const [majorNumber = "1", minorNumber = "0"] = stableVersion.split(".");

  return `${majorNumber}.${Number(minorNumber) + 1}.0-edge.3f2c1ab`;
}

/** The demo's default: the version it was built as, so the sidebar and About show the real release. */
const defaultMockInstallProfile: MockInstallProfile = {
  key: "current-homebrew",
  label: "This version, Homebrew on macOS",
  version: builtAppVersion,
  releaseChannel: builtAppVersion.includes("-") ? "beta" : "stable",
  installMethod: "homebrew",
  operatingSystem: "macos",
};

export const mockInstallProfiles: MockInstallProfile[] = [
  defaultMockInstallProfile,
  {
    key: "beta-homebrew",
    label: "Beta, Homebrew on macOS",
    version: latestStableFirstBetaVersion,
    releaseChannel: "beta",
    installMethod: "homebrew",
    operatingSystem: "macos",
  },
  {
    key: "stable-docker",
    label: "Stable, Docker",
    version: previousStableVersion,
    releaseChannel: "stable",
    installMethod: "docker",
    operatingSystem: "linux",
  },
  {
    key: "stable-install-script-linux",
    label: "Stable, install script on Linux",
    version: previousStableVersion,
    releaseChannel: "stable",
    installMethod: "install_script",
    operatingSystem: "linux",
  },
  {
    key: "beta-install-script-windows",
    label: "Beta, install script on Windows",
    version: latestStableFirstBetaVersion,
    releaseChannel: "beta",
    installMethod: "install_script",
    operatingSystem: "windows",
  },
  {
    key: "stable-scoop",
    label: "Stable, Scoop on Windows",
    version: previousStableVersion,
    releaseChannel: "stable",
    installMethod: "scoop",
    operatingSystem: "windows",
  },
  {
    key: "beta-npm",
    label: "Beta, npm",
    version: latestStableFirstBetaVersion,
    releaseChannel: "beta",
    installMethod: "npm",
    operatingSystem: "linux",
  },
  {
    key: "stable-unknown",
    label: "Stable, install method unknown",
    version: previousStableVersion,
    releaseChannel: "stable",
    installMethod: "unknown",
    operatingSystem: "linux",
  },
  {
    key: "stable-latest",
    label: "Stable, already the newest",
    version: latestStableRelease.version,
    releaseChannel: "stable",
    installMethod: "homebrew",
    operatingSystem: "macos",
  },
  {
    key: "edge-docker",
    label: "Edge image from develop",
    version: toNextMinorEdgeVersion(latestStableRelease.version),
    releaseChannel: "edge",
    installMethod: "docker",
    operatingSystem: "linux",
  },
  {
    key: "dev",
    label: "Development build",
    version: "0.0.0-dev",
    releaseChannel: "dev",
    installMethod: "unknown",
    operatingSystem: "macos",
  },
];

export const defaultMockInstallProfileKey = defaultMockInstallProfile.key;

export function findMockInstallProfile(
  installProfileKey: string,
): MockInstallProfile {
  return (
    mockInstallProfiles.find(
      (installProfile) => installProfile.key === installProfileKey,
    ) ?? defaultMockInstallProfile
  );
}

/** Pretend GitHub Releases, newest first; the notes are the `CHANGELOG.md` sections, as on GitHub. */
export const mockPublishedReleases: PublishedRelease[] = mockStableReleases.map(
  (stableRelease) => ({
    version: stableRelease.version,
    // Midday keeps the release on its own date in every time zone.
    publishedAt: `${stableRelease.releasedOn}T12:00:00Z`,
    isPrerelease: false,
    releaseNotesMarkdown: stableRelease.notesMarkdown,
  }),
);
