import { describe, expect, test } from "vitest";

import { buildUpgradeCommand } from "@/mocks/updates/build-upgrade-command";

describe("buildUpgradeCommand", () => {
  test("PL-05.11 gives the upgrade command for each install method", () => {
    const stableCommands = {
      homebrew: "brew upgrade shibbirweb/tap/sendmock",
      scoop: "scoop update sendmock",
      docker: "docker pull ghcr.io/shibbirweb/sendmock:0.1.1",
      install_script:
        "curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh",
      npm: "npm install -g sendmock@0.1.1",
    } as const;

    for (const [installMethod, upgradeCommand] of Object.entries(
      stableCommands,
    )) {
      expect(
        buildUpgradeCommand({
          installMethod: installMethod as keyof typeof stableCommands,
          operatingSystem:
            installMethod === "scoop" ? "windows" : ("linux" as const),
          releaseChannel: "stable",
          offeredVersion: "0.1.1",
        }),
      ).toBe(upgradeCommand);
    }
  });

  test("PL-05.11 uses the beta packages for beta installs", () => {
    expect(
      buildUpgradeCommand({
        installMethod: "homebrew",
        operatingSystem: "macos",
        releaseChannel: "beta",
        offeredVersion: "0.2.0-beta.1",
      }),
    ).toBe("brew upgrade shibbirweb/tap/sendmock-beta");
    expect(
      buildUpgradeCommand({
        installMethod: "install_script",
        operatingSystem: "linux",
        releaseChannel: "beta",
        offeredVersion: "0.2.0-beta.1",
      }),
    ).toContain("sh -s -- --channel beta");
  });

  test("PL-05.11 has no command when the install method is unknown", () => {
    expect(
      buildUpgradeCommand({
        installMethod: "unknown",
        operatingSystem: "macos",
        releaseChannel: "stable",
        offeredVersion: "0.1.1",
      }),
    ).toBeNull();
  });

  test("PL-05.13 uses the PowerShell install script on Windows", () => {
    expect(
      buildUpgradeCommand({
        installMethod: "install_script",
        operatingSystem: "windows",
        releaseChannel: "stable",
        offeredVersion: "0.1.1",
      }),
    ).toBe(
      "irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex",
    );
    expect(
      buildUpgradeCommand({
        installMethod: "install_script",
        operatingSystem: "windows",
        releaseChannel: "beta",
        offeredVersion: "0.2.0-beta.1",
      }),
    ).toBe(
      "& ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1))) -Channel beta",
    );
  });

  test("PL-05.13 offers no command for a method the platform does not have", () => {
    expect(
      buildUpgradeCommand({
        installMethod: "homebrew",
        operatingSystem: "windows",
        releaseChannel: "stable",
        offeredVersion: "0.1.1",
      }),
    ).toBeNull();
    for (const operatingSystem of ["macos", "linux"] as const) {
      expect(
        buildUpgradeCommand({
          installMethod: "scoop",
          operatingSystem,
          releaseChannel: "stable",
          offeredVersion: "0.1.1",
        }),
      ).toBeNull();
    }
  });

  test("PL-05.13 gives Docker and npm the same command on every platform", () => {
    for (const installMethod of ["docker", "npm"] as const) {
      const platformCommands = (["macos", "linux", "windows"] as const).map(
        (operatingSystem) =>
          buildUpgradeCommand({
            installMethod,
            operatingSystem,
            releaseChannel: "stable",
            offeredVersion: "0.1.1",
          }),
      );
      expect(new Set(platformCommands).size).toBe(1);
    }
  });
});
