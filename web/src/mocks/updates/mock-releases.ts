import type { InstallMethod, ReleaseChannel } from "@/lib/api/types";
import type { OperatingSystem } from "@/mocks/updates/build-upgrade-command";
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

/** The demo's default, so the preview shows an update to install. */
const defaultMockInstallProfile: MockInstallProfile = {
  key: "beta-homebrew",
  label: "Beta, Homebrew on macOS",
  version: "0.1.0-beta.2",
  releaseChannel: "beta",
  installMethod: "homebrew",
  operatingSystem: "macos",
};

export const mockInstallProfiles: MockInstallProfile[] = [
  defaultMockInstallProfile,
  {
    key: "stable-docker",
    label: "Stable, Docker",
    version: "0.1.0",
    releaseChannel: "stable",
    installMethod: "docker",
    operatingSystem: "linux",
  },
  {
    key: "stable-install-script-linux",
    label: "Stable, install script on Linux",
    version: "0.1.0",
    releaseChannel: "stable",
    installMethod: "install_script",
    operatingSystem: "linux",
  },
  {
    key: "beta-install-script-windows",
    label: "Beta, install script on Windows",
    version: "0.1.0-beta.2",
    releaseChannel: "beta",
    installMethod: "install_script",
    operatingSystem: "windows",
  },
  {
    key: "stable-scoop",
    label: "Stable, Scoop on Windows",
    version: "0.1.0",
    releaseChannel: "stable",
    installMethod: "scoop",
    operatingSystem: "windows",
  },
  {
    key: "beta-npm",
    label: "Beta, npm",
    version: "0.1.0-beta.2",
    releaseChannel: "beta",
    installMethod: "npm",
    operatingSystem: "linux",
  },
  {
    key: "stable-unknown",
    label: "Stable, install method unknown",
    version: "0.1.0",
    releaseChannel: "stable",
    installMethod: "unknown",
    operatingSystem: "linux",
  },
  {
    key: "stable-latest",
    label: "Stable, already the newest",
    version: "0.1.1",
    releaseChannel: "stable",
    installMethod: "homebrew",
    operatingSystem: "macos",
  },
  {
    key: "edge-docker",
    label: "Edge image from develop",
    version: "0.2.0-edge.3f2c1ab",
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

/** Pretend GitHub Releases, newest first; the notes are `CHANGELOG.md` sections. */
export const mockPublishedReleases: PublishedRelease[] = [
  {
    version: "0.2.0-beta.1",
    publishedAt: "2026-10-24T09:30:00Z",
    isPrerelease: true,
    releaseNotesMarkdown: [
      "### Added",
      "",
      "- Update checker with Off, Manual and Daily modes (#41)",
      "- Configurable email and SMS providers (#36)",
      "",
      "### Fixed",
      "",
      "- Toasts no longer cover the message composer (#32)",
    ].join("\n"),
  },
  {
    version: "0.1.1",
    publishedAt: "2026-10-18T14:00:00Z",
    isPrerelease: false,
    releaseNotesMarkdown: [
      "### Fixed",
      "",
      "- The SMS thread list keeps its scroll position after a reply (#35)",
      "- Webhook retries honour the Retry-After header (#34)",
    ].join("\n"),
  },
  {
    version: "0.1.0",
    publishedAt: "2026-10-10T10:00:00Z",
    isPrerelease: false,
    releaseNotesMarkdown: "### Added\n\n- First stable release (#30)",
  },
  {
    version: "0.1.0-beta.2",
    publishedAt: "2026-10-03T10:00:00Z",
    isPrerelease: true,
    releaseNotesMarkdown:
      "### Fixed\n\n- Seed import keeps provider order (#28)",
  },
];
