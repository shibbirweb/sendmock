import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildUpgradeCommand } from "../../src/mocks/updates/build-upgrade-command";

const installPage = readFileSync(
  join(import.meta.dir, "../../../docs/wiki/install.md"),
  "utf8",
);

const platforms = ["macos", "linux", "windows"] as const;
const channels = ["stable", "beta"] as const;

test("PL-05.13 every install script upgrade command is the Install page's command for its platform and channel", () => {
  for (const operatingSystem of platforms) {
    for (const releaseChannel of channels) {
      const upgradeCommand = buildUpgradeCommand({
        installMethod: "install_script",
        operatingSystem,
        releaseChannel,
        offeredVersion: "0.1.1",
      });

      expect(installPage).toContain(`   ${upgradeCommand ?? "missing"}\n`);
    }
  }
});

test("PL-05.13 Homebrew upgrades the formula the Install page installs", () => {
  for (const releaseChannel of channels) {
    const upgradeCommand = buildUpgradeCommand({
      installMethod: "homebrew",
      operatingSystem: "macos",
      releaseChannel,
      offeredVersion: "0.1.1",
    });
    const formulaName = upgradeCommand?.replace("brew upgrade ", "") ?? "";

    expect(installPage).toContain(`brew install ${formulaName}\n`);
  }
});

test("PL-05.13 Docker pulls the image the Install page runs", () => {
  const upgradeCommand = buildUpgradeCommand({
    installMethod: "docker",
    operatingSystem: "linux",
    releaseChannel: "stable",
    offeredVersion: "0.1.1",
  });
  const imageName = upgradeCommand?.match(/docker pull ([^:]+):/)?.[1] ?? "";

  expect(installPage).toContain(`-p 8025:8025 ${imageName}\n`);
});
