import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildChannelMatrix,
  installPagePath,
  readInstallChannels,
  readPageSection,
  renderChannelTable,
  toHeadingAnchor,
  writeChannelTable,
} from "./install-channels";

const repositoryRoot = join(import.meta.dir, "../..");
const channels = readInstallChannels();
const installPage = readFileSync(join(repositoryRoot, installPagePath), "utf8");

function readStepNames(workflowFileName: string): string[] {
  const workflow = Bun.YAML.parse(
    readFileSync(
      join(repositoryRoot, ".github/workflows", workflowFileName),
      "utf8",
    ),
  ) as { jobs: Record<string, { steps?: { name?: string }[] }> };
  return Object.values(workflow.jobs).flatMap((job) =>
    (job.steps ?? []).map((step) => step.name ?? ""),
  );
}

describe("install channels", () => {
  test("DS-03.6 the list holds every channel SendMock ships on (plan 09)", () => {
    expect(channels.map((channel) => channel.key)).toEqual([
      "homebrew",
      "install-script-unix",
      "install-script-windows",
      "apt",
      "dnf",
      "aur",
      "copr",
      "nix",
      "scoop",
      "winget",
      "chocolatey",
      "npm",
      "cargo",
      "docker",
      "binaries",
    ]);
  });

  test("DS-03.6 the install page's table is the one the channel list makes", () => {
    expect(writeChannelTable(installPage, renderChannelTable(channels))).toBe(
      installPage,
    );
  });

  test("DS-03.6 every channel has its section on the install page with its install commands", () => {
    for (const channel of channels) {
      const section = readPageSection(installPage, channel.section);
      expect({ channel: channel.key, hasSection: section !== null }).toEqual({
        channel: channel.key,
        hasSection: true,
      });
      for (const pageCommand of channel.page_commands) {
        expect({
          channel: channel.key,
          pageCommand,
          isShown: section?.includes(pageCommand),
        }).toEqual({
          channel: channel.key,
          pageCommand,
          isShown: true,
        });
      }
    }
  });

  test("DS-03.6 every channel is smoke tested by a step of the release workflows", () => {
    for (const channel of channels) {
      const stepNames = readStepNames(channel.release_test.workflow);
      expect({
        channel: channel.key,
        isTested: stepNames.some((stepName) =>
          stepName.includes(channel.release_test.step),
        ),
      }).toEqual({ channel: channel.key, isTested: true });
    }
  });

  test("DS-03.6 every channel the workflow installs runs test cases 2 to 8 on each runner", () => {
    const stableMatrix = buildChannelMatrix(channels, "stable", undefined);

    expect(stableMatrix.length).toBeGreaterThan(15);
    for (const matrixEntry of stableMatrix) {
      expect(matrixEntry.script).toContain(
        "bun scripts/release/check-installed.ts",
      );
    }
    expect(
      stableMatrix.find((entry) => entry.name === "dnf on fedora:42")
        ?.container,
    ).toBe("fedora:42");
    expect(
      stableMatrix.find((entry) => entry.name === "Homebrew on macos-latest")
        ?.container,
    ).toBe("");
  });
});

describe("channel matrix", () => {
  test("a beta leaves out the channels that have only the stable", () => {
    const betaNames = buildChannelMatrix(channels, "beta", undefined).map(
      (entry) => entry.name,
    );

    expect(betaNames).toContain("Homebrew on macos-latest");
    expect(betaNames.some((name) => name.startsWith("WinGet"))).toBe(false);
    expect(betaNames.some((name) => name.startsWith("Cargo"))).toBe(false);
  });

  test("filters by channel keys or by when a channel has the release", () => {
    expect(
      buildChannelMatrix(channels, "stable", "winget,cargo").map(
        (entry) => entry.name,
      ),
    ).toEqual(["WinGet on windows-latest", "Cargo on ubuntu-latest"]);
    const afterPublishNames = buildChannelMatrix(
      channels,
      "stable",
      "after-publish",
    ).map((entry) => entry.name);
    expect(
      afterPublishNames.some((name) => name.startsWith("Chocolatey")),
    ).toBe(false);
    expect(afterPublishNames).toContain("Scoop on windows-latest");
  });

  test("PowerShell jobs fail on the check's exit code", () => {
    const scoopEntry = buildChannelMatrix(channels, "stable", "scoop")[0];

    expect(scoopEntry?.shell).toBe("pwsh");
    expect(scoopEntry?.script).toContain(
      "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
    );
  });

  test("heading anchors match the docs site's", () => {
    expect(toHeadingAnchor("dnf (Fedora, RHEL and similar)")).toBe(
      "dnf-fedora-rhel-and-similar",
    );
    expect(toHeadingAnchor("npm (projects with Node.js)")).toBe(
      "npm-projects-with-nodejs",
    );
  });
});
