import type { InstallMethod, ReleaseChannel } from "@/lib/api/types";

/** The platform SendMock runs on; the server detects it at run time. */
export type OperatingSystem = "macos" | "linux" | "windows";

const releaseDownloadUrl =
  "https://github.com/shibbirweb/sendmock/releases/latest/download";

/** The Install page's install script command for the platform and channel. */
function buildInstallScriptCommand(
  operatingSystem: OperatingSystem,
  isBeta: boolean,
): string {
  if (operatingSystem === "windows") {
    return isBeta
      ? `& ([scriptblock]::Create((irm ${releaseDownloadUrl}/install.ps1))) -Channel beta`
      : `irm ${releaseDownloadUrl}/install.ps1 | iex`;
  }

  return isBeta
    ? `curl -fsSL ${releaseDownloadUrl}/install.sh | sh -s -- --channel beta`
    : `curl -fsSL ${releaseDownloadUrl}/install.sh | sh`;
}

/**
 * The command that upgrades this install (PL-05.11, PL-05.13): the Install
 * page's command for the platform, channel and install method. Null when the
 * method is unknown or does not exist on the platform, so the UI links the
 * release page instead.
 */
export function buildUpgradeCommand({
  installMethod,
  operatingSystem,
  releaseChannel,
  offeredVersion,
}: {
  installMethod: InstallMethod;
  operatingSystem: OperatingSystem;
  releaseChannel: ReleaseChannel;
  offeredVersion: string;
}): string | null {
  const isBeta = releaseChannel === "beta";
  const isWindows = operatingSystem === "windows";
  const packageName = isBeta ? "sendmock-beta" : "sendmock";
  const upgradeCommands: Record<InstallMethod, string | null> = {
    homebrew: isWindows ? null : `brew upgrade shibbirweb/tap/${packageName}`,
    scoop: isWindows ? `scoop update ${packageName}` : null,
    docker: `docker pull ghcr.io/shibbirweb/sendmock:${offeredVersion}`,
    install_script: buildInstallScriptCommand(operatingSystem, isBeta),
    npm: `npm install -g sendmock@${offeredVersion}`,
    unknown: null,
  };

  return upgradeCommands[installMethod];
}
