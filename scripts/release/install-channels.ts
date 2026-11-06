#!/usr/bin/env bun
/**
 * The install channels in packaging/channels.json: the install page's channel table, and the
 * matrix the Install channels workflow installs from the real registries (DS-03.6).
 *
 *     bun scripts/release/install-channels.ts table          rewrite the install page's table
 *     bun scripts/release/install-channels.ts matrix <stage> [availability|key,key]
 *         the workflow matrix; with no filter every channel for the stage, `after-publish`
 *         only those available right after a release, or a list of channel keys
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ReleaseStage = "stable" | "beta";

export type ChannelInstall = {
  runner: string;
  container?: string;
  shell: "bash" | "pwsh";
  prepare?: string;
  install: Partial<Record<ReleaseStage, string>>;
  command: string;
};

export type InstallChannel = {
  key: string;
  name: string;
  section: string;
  systems: ("macos" | "linux" | "windows")[];
  stages: ReleaseStage[];
  availability: "after-publish" | "later";
  page_commands: string[];
  release_test: { workflow: string; step: string };
  installs: ChannelInstall[];
};

export type ChannelMatrixEntry = {
  name: string;
  runner: string;
  container: string;
  shell: string;
  prepare: string;
  script: string;
};

const repositoryRoot = join(import.meta.dir, "../..");
export const installPagePath = "docs/wiki/install.md";
export const tableHeading = "## Which way to choose";
const systemNames = { macos: "macOS", linux: "Linux", windows: "Windows" };

export function readInstallChannels(): InstallChannel[] {
  const channelFile = JSON.parse(
    readFileSync(join(repositoryRoot, "packaging/channels.json"), "utf8"),
  ) as { channels: InstallChannel[] };
  return channelFile.channels;
}

/** The anchor the docs site gives a heading: lower case, words joined by hyphens. */
export function toHeadingAnchor(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function renderChannelTable(channels: InstallChannel[]): string {
  const rows = channels.map((channel) => {
    const systems = channel.systems
      .map((system) => systemNames[system])
      .join(", ");
    const stageCell = (stage: ReleaseStage) =>
      channel.stages.includes(stage) ? "Yes" : "No";
    return `| [${channel.name}](#${toHeadingAnchor(channel.section)}) | ${systems} | ${stageCell("stable")} | ${stageCell("beta")} |`;
  });
  return [
    "| Way to install | Systems | Stable | Beta |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}

/** The install page's text under a heading, up to the next heading of the same level. */
export function readPageSection(
  pageText: string,
  headingText: string,
): string | null {
  const headingLine = headingText.startsWith("#")
    ? headingText
    : `## ${headingText}`;
  const startIndex = pageText.indexOf(`\n${headingLine}\n`);
  if (startIndex === -1) {
    return null;
  }
  const bodyStart = startIndex + headingLine.length + 2;
  const nextHeadingIndex = pageText.indexOf("\n## ", bodyStart);
  return pageText.slice(
    bodyStart,
    nextHeadingIndex === -1 ? undefined : nextHeadingIndex,
  );
}

/** Replaces the table in the "Which way to choose" section, keeping the text around it. */
export function writeChannelTable(pageText: string, table: string): string {
  const section = readPageSection(pageText, tableHeading);
  if (section === null) {
    throw new Error(`${installPagePath} has no "${tableHeading}" section`);
  }
  const tableLines = section.split("\n").filter((line) => line.startsWith("|"));
  const oldTable = tableLines.join("\n");
  const newSection =
    oldTable === ""
      ? `${section.trimEnd()}\n\n${table}\n`
      : section.replace(oldTable, table);
  return pageText.replace(
    `${tableHeading}\n${section}`,
    `${tableHeading}\n${newSection}`,
  );
}

function buildCheckLine(shell: string, command: string): string {
  return shell === "pwsh"
    ? `bun scripts/release/check-installed.ts "${command}" $env:VERSION $env:RELEASE_CHANNEL\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`
    : `bun scripts/release/check-installed.ts "${command}" "$VERSION" "$RELEASE_CHANNEL"`;
}

/** One job per channel and runner that installs the stage, then runs test cases 2 to 8. */
export function buildChannelMatrix(
  channels: InstallChannel[],
  stage: ReleaseStage,
  channelFilter: string | undefined,
): ChannelMatrixEntry[] {
  const filterKeys =
    channelFilter?.split(",").filter((key) => key !== "") ?? [];
  const isSelected = (channel: InstallChannel) =>
    filterKeys.length === 0 ||
    filterKeys.includes(channel.key) ||
    filterKeys.includes(channel.availability);
  return channels
    .filter((channel) => channel.stages.includes(stage) && isSelected(channel))
    .flatMap((channel) =>
      channel.installs.flatMap((channelInstall) => {
        const installScript = channelInstall.install[stage];
        if (installScript === undefined) {
          return [];
        }
        return [
          {
            name: `${channel.name} on ${channelInstall.container ?? channelInstall.runner}`,
            runner: channelInstall.runner,
            container: channelInstall.container ?? "",
            shell: channelInstall.shell,
            prepare: channelInstall.prepare ?? "",
            script: `${installScript}\n${buildCheckLine(channelInstall.shell, channelInstall.command)}`,
          },
        ];
      }),
    );
}

if (import.meta.main) {
  const [command, stageArgument, channelFilter] = process.argv.slice(2);
  const channels = readInstallChannels();
  if (command === "table") {
    const pageFile = join(repositoryRoot, installPagePath);
    writeFileSync(
      pageFile,
      writeChannelTable(
        readFileSync(pageFile, "utf8"),
        renderChannelTable(channels),
      ),
    );
    console.log(`Wrote the channel table into ${installPagePath}`);
  } else if (
    command === "matrix" &&
    (stageArgument === "stable" || stageArgument === "beta")
  ) {
    console.log(
      JSON.stringify({
        include: buildChannelMatrix(channels, stageArgument, channelFilter),
      }),
    );
  } else {
    console.error(
      "Usage: bun scripts/release/install-channels.ts table|matrix <stable|beta> [filter]",
    );
    process.exit(2);
  }
}
