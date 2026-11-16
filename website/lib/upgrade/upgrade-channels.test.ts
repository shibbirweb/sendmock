import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chooseStepCommand, upgradeChannels } from "./upgrade-channels";

const installPageMarkdown = readFileSync(
  fileURLToPath(new URL("../../../docs/wiki/install.md", import.meta.url)),
  "utf8",
);

/** The anchor the docs give a heading: lower case, punctuation dropped, spaces as dashes. */
function toHeadingAnchor(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s/g, "-");
}

const installPageAnchors = installPageMarkdown
  .split("\n")
  .filter((line) => line.startsWith("## "))
  .map((line) => toHeadingAnchor(line.slice(3).trim()));

describe("the upgrade guide's channels", () => {
  test("WS-14.3 every channel links to its section of the Install page", () => {
    for (const upgradeChannel of upgradeChannels) {
      expect(installPageAnchors, upgradeChannel.name).toContain(
        upgradeChannel.installAnchor,
      );
    }
  });

  test("WS-14.3 the beta docs show the beta commands, and the stable ones elsewhere", () => {
    const homebrewUpgrade = upgradeChannels
      .find((upgradeChannel) => upgradeChannel.name === "Homebrew")
      ?.steps.at(-1);
    const dnfUpgrade = upgradeChannels.find((upgradeChannel) =>
      upgradeChannel.name.startsWith("dnf"),
    )?.steps[0];

    expect(homebrewUpgrade && chooseStepCommand(homebrewUpgrade, true)).toBe(
      "brew upgrade shibbirweb/tap/sendmock-beta",
    );
    expect(homebrewUpgrade && chooseStepCommand(homebrewUpgrade, false)).toBe(
      "brew upgrade shibbirweb/tap/sendmock",
    );
    expect(dnfUpgrade && chooseStepCommand(dnfUpgrade, true)).toBe(
      "sudo dnf upgrade sendmock",
    );
  });

  test("WS-14.3 every step runs one command", () => {
    for (const upgradeChannel of upgradeChannels) {
      expect(upgradeChannel.steps.length, upgradeChannel.name).toBeGreaterThan(
        0,
      );
      for (const upgradeStep of upgradeChannel.steps) {
        expect(
          upgradeStep.stableCommand.includes("\n"),
          upgradeChannel.name,
        ).toBe(false);
      }
    }
  });
});
