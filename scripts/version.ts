#!/usr/bin/env bun
/**
 * Version and changelog (docs/plan/16-website-and-releases.md, Versioning).
 *
 *     bun scripts/version.ts show                 the version in Cargo.toml
 *     bun scripts/version.ts check                every file carries the same version
 *     bun scripts/version.ts sync                 copy the Cargo.toml version into every file
 *     bun scripts/version.ts next <bump>          what a bump would make, without writing
 *     bun scripts/version.ts bump <bump>          write the next version into every file
 *     bun scripts/version.ts changelog [--pull-requests <file>]
 *                                                 write the CHANGELOG.md section for the version
 *     bun scripts/version.ts notes <version>      print a version's section (the release body)
 *
 * `<bump>` is beta, patch, minor, major or stable. The pull request list comes from the
 * merge commits, or from a JSON file of `{ number, title }` (the release workflow passes
 * GitHub's titles, which may have been edited after merging).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { classifyChange, type MergedPullRequest } from "./version/change-kind";
import {
  extractReleaseNotes,
  insertChangelogSection,
  renderChangelogSection,
} from "./version/changelog";
import {
  computeNextVersion,
  type ReleaseBump,
  releaseBumps,
} from "./version/next-version";
import {
  findLastStable,
  findSectionStartTag,
  readMergedPullRequestsSince,
  readReleaseTags,
} from "./version/release-history";
import {
  formatVersion,
  parseVersion,
  type SemanticVersion,
} from "./version/semantic-version";
import {
  findDisagreeingFiles,
  readAllVersions,
  readWorkspaceVersion,
  workspaceManifestPath,
  writeAllVersions,
} from "./version/version-files";

const repositoryRoot = join(import.meta.dir, "..");
const changelogPath = join(repositoryRoot, "CHANGELOG.md");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readCurrentVersion(): SemanticVersion {
  const versionText = readWorkspaceVersion(
    readFileSync(join(repositoryRoot, workspaceManifestPath), "utf8"),
  );
  return (
    parseVersion(versionText ?? "") ??
    fail(`Cargo.toml has no valid version: ${versionText}`)
  );
}

function readBump(bumpArgument: string | undefined): ReleaseBump {
  return releaseBumps.includes(bumpArgument as ReleaseBump)
    ? (bumpArgument as ReleaseBump)
    : fail(`Choose a bump: ${releaseBumps.join(", ")}`);
}

function readPullRequests(
  startTag: SemanticVersion | null,
): MergedPullRequest[] {
  const optionIndex = process.argv.indexOf("--pull-requests");
  const pullRequestsPath =
    optionIndex === -1 ? null : process.argv[optionIndex + 1];
  return pullRequestsPath
    ? (JSON.parse(
        readFileSync(pullRequestsPath, "utf8"),
      ) as MergedPullRequest[])
    : readMergedPullRequestsSince(startTag, repositoryRoot);
}

function workOutNextVersion(bump: ReleaseBump): SemanticVersion {
  const currentVersion = readCurrentVersion();
  const tags = readReleaseTags(repositoryRoot);
  const nextVersion = computeNextVersion(bump, {
    currentVersion,
    lastStableVersion: findLastStable(tags),
    isCurrentVersionTagged: tags.some(
      (tag) => formatVersion(tag) === formatVersion(currentVersion),
    ),
    changeKindsSinceLastTag: readPullRequests(tags.at(-1) ?? null).map(
      (pullRequest) => classifyChange(pullRequest.title),
    ),
  });
  return "refusal" in nextVersion
    ? fail(nextVersion.refusal)
    : nextVersion.version;
}

function writeChangelog() {
  const currentVersion = readCurrentVersion();
  const startTag = findSectionStartTag(
    currentVersion,
    readReleaseTags(repositoryRoot),
  );
  const releaseDate = new Date().toISOString().slice(0, 10);
  const section = renderChangelogSection(
    formatVersion(currentVersion),
    releaseDate,
    readPullRequests(startTag),
  );
  const existingChangelog = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8")
    : null;
  writeFileSync(
    changelogPath,
    insertChangelogSection(existingChangelog, section),
  );
  console.log(section);
}

function printReleaseNotes(versionArgument: string | undefined) {
  const changelog = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf8")
    : "";
  const releaseNotes = extractReleaseNotes(changelog, versionArgument ?? "");
  console.log(
    releaseNotes ?? fail(`CHANGELOG.md has no section for ${versionArgument}`),
  );
}

function checkVersionFiles() {
  const disagreeingFiles = findDisagreeingFiles(
    readAllVersions(repositoryRoot),
  );
  if (disagreeingFiles.length > 0) {
    fail(
      [
        `These files disagree with Cargo.toml (${formatVersion(readCurrentVersion())}); run bun scripts/version.ts sync:`,
        ...disagreeingFiles.map(
          (file) => `  ${file.filePath}: ${file.version ?? "no version"}`,
        ),
      ].join("\n"),
    );
  }
  console.log(`Every file carries ${formatVersion(readCurrentVersion())}.`);
}

const [command, commandArgument] = process.argv.slice(2);
switch (command) {
  case "show":
    console.log(formatVersion(readCurrentVersion()));
    break;
  case "check":
    checkVersionFiles();
    break;
  case "sync":
    writeAllVersions(repositoryRoot, formatVersion(readCurrentVersion()));
    break;
  case "next":
    console.log(formatVersion(workOutNextVersion(readBump(commandArgument))));
    break;
  case "bump": {
    const nextVersion = formatVersion(
      workOutNextVersion(readBump(commandArgument)),
    );
    writeAllVersions(repositoryRoot, nextVersion);
    console.log(nextVersion);
    break;
  }
  case "changelog":
    writeChangelog();
    break;
  case "notes":
    printReleaseNotes(commandArgument);
    break;
  default:
    fail(
      "Usage: bun scripts/version.ts show|check|sync|next <bump>|bump <bump>|changelog|notes <version>",
    );
}
