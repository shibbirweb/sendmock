import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildChannelMatrix,
  installPagePath,
  readInstallChannels,
  readPageSection,
  isListedChannel,
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
      "npx",
      "bunx",
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

  test("DS-03.6 every listed channel has its section on the install page with its install commands", () => {
    for (const channel of channels.filter(isListedChannel)) {
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

describe("channels without an account yet", () => {
  const unlistedChannels = channels.filter(
    (channel) => !isListedChannel(channel),
  );

  test("DS-03.5 the AUR and COPR stay off the install page and out of the install tests", () => {
    expect(unlistedChannels.map((channel) => channel.key)).toEqual([
      "aur",
      "copr",
    ]);
    for (const channel of unlistedChannels) {
      expect(readPageSection(installPage, channel.section)).toBeNull();
      expect(renderChannelTable(channels)).not.toContain(`[${channel.name}]`);
      expect(buildChannelMatrix(channels, "stable", channel.key)).toEqual([]);
    }
  });
});

describe("bunx with no install", () => {
  const bunxChannel = channels.find((channel) => channel.key === "bunx");

  test("DS-03.7 bunx runs the published stable and beta on macOS, Linux and Windows with no install", () => {
    const stableMatrix = buildChannelMatrix(channels, "stable", "bunx");
    const betaMatrix = buildChannelMatrix(channels, "beta", "bunx");

    expect(bunxChannel?.systems).toEqual(["macos", "linux", "windows"]);
    expect(stableMatrix.map((entry) => entry.runner)).toEqual([
      "ubuntu-latest",
      "macos-latest",
      "windows-latest",
    ]);
    for (const matrixEntry of stableMatrix) {
      expect(matrixEntry.script).toContain("bunx sendmock@latest");
    }
    for (const matrixEntry of betaMatrix) {
      expect(matrixEntry.script).toContain("bunx sendmock@beta");
    }
  });

  test("DS-03.7 the install page has a bunx section, and the channel table lists npx and bunx first", () => {
    const section = readPageSection(installPage, "bunx (no install)");

    for (const runCommand of ["bunx sendmock", "bunx sendmock@beta"]) {
      expect({ runCommand, isShown: section?.includes(runCommand) }).toEqual({
        runCommand,
        isShown: true,
      });
    }
    expect(channels.slice(0, 2).map((channel) => channel.key)).toEqual([
      "npx",
      "bunx",
    ]);
  });
});

describe("npx with no install", () => {
  const npxChannel = channels.find((channel) => channel.key === "npx");

  test("DS-03.7 npx runs the published stable and beta on macOS, Linux and Windows with no install", () => {
    const stableMatrix = buildChannelMatrix(channels, "stable", "npx");
    const betaMatrix = buildChannelMatrix(channels, "beta", "npx");

    expect(npxChannel?.systems).toEqual(["macos", "linux", "windows"]);
    expect(stableMatrix.map((entry) => entry.runner)).toEqual([
      "ubuntu-latest",
      "macos-latest",
      "windows-latest",
    ]);
    for (const matrixEntry of stableMatrix) {
      expect(matrixEntry.script).toContain("npx --yes sendmock@latest");
      expect(matrixEntry.script).not.toContain("npm install");
    }
    for (const matrixEntry of betaMatrix) {
      expect(matrixEntry.script).toContain("npx --yes sendmock@beta");
    }
  });

  test("DS-03.7 the install page shows npx, bunx, pnpm dlx and yarn dlx as a way to run with no install", () => {
    const section = readPageSection(installPage, "npx (no install)");

    for (const runCommand of [
      "npx sendmock",
      "npx sendmock@beta",
      "bunx sendmock",
      "pnpm dlx sendmock",
      "yarn dlx sendmock",
    ]) {
      expect({ runCommand, isShown: section?.includes(runCommand) }).toEqual({
        runCommand,
        isShown: true,
      });
    }
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
