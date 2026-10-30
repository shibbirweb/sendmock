#!/usr/bin/env bun
/**
 * The decisions behind the release workflows (docs/plan/16-website-and-releases.md,
 * Workflows), so each workflow stays a thin YAML file.
 *
 *     bun scripts/release/release.ts readiness
 *     bun scripts/release/release.ts decide beta-publish|stable-promote|stable-publish
 *     bun scripts/release/release.ts merged-pull-requests --since last-tag|last-stable
 *     bun scripts/release/release.ts agreement <tag> <is-prerelease>
 *     bun scripts/release/release.ts release-number
 *
 * `decide` writes `should_act`, `version` and `tag_name` to `$GITHUB_OUTPUT` when set.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readReleaseTags } from "../version/release-history";
import { formatVersion, isBeta } from "../version/semantic-version";
import { readWorkspaceVersion } from "../version/version-files";
import {
  fetchCiConclusion,
  fetchOpenReleasePullRequestNumbers,
  fetchPullRequestsMergedSince,
} from "./github-api";
import {
  decidePublication,
  findNextReleaseNumber,
  findReleaseBlockers,
  findVersionMismatches,
  type PublicationWorkflow,
} from "./release-decisions";

const repositoryRoot = join(import.meta.dir, "../..");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readVersionInCode(): string {
  return (
    readWorkspaceVersion(
      readFileSync(join(repositoryRoot, "Cargo.toml"), "utf8"),
    ) ?? fail("Cargo.toml has no version")
  );
}

function readTagNames(): string[] {
  return readReleaseTags(repositoryRoot).map((tag) => `v${formatVersion(tag)}`);
}

function readTagTime(tagName: string): string {
  const gitResult = Bun.spawnSync(
    ["git", "log", "-1", "--format=%cI", tagName],
    { cwd: repositoryRoot },
  );
  return new Date(gitResult.stdout.toString().trim()).toISOString();
}

function writeGitHubOutputs(outputs: Record<string, string>) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(
      outputPath,
      Object.entries(outputs)
        .map(([outputName, outputValue]) => `${outputName}=${outputValue}\n`)
        .join(""),
    );
  }
}

async function checkReadiness() {
  const releaseBlockers = findReleaseBlockers({
    ciConclusion: await fetchCiConclusion(process.env.GITHUB_SHA ?? "HEAD"),
    openReleasePullRequestNumbers: await fetchOpenReleasePullRequestNumbers(),
  });
  if (releaseBlockers.length > 0) {
    fail(releaseBlockers.join("\n"));
  }
  console.log("CI passed on this commit and no release is in progress.");
}

function decide(publicationWorkflow: PublicationWorkflow) {
  const decision = decidePublication(
    publicationWorkflow,
    readVersionInCode(),
    readTagNames(),
  );
  console.log(JSON.stringify(decision));
  writeGitHubOutputs(
    decision.shouldAct
      ? {
          should_act: "true",
          version: decision.version,
          tag_name: decision.tagName,
        }
      : { should_act: "false" },
  );
}

async function printMergedPullRequests(sinceChoice: string | undefined) {
  const tags = readReleaseTags(repositoryRoot);
  const candidateTags =
    sinceChoice === "last-stable" ? tags.filter((tag) => !isBeta(tag)) : tags;
  const startTag = candidateTags.at(-1) ?? null;
  const sinceIsoTime =
    startTag === null ? null : readTagTime(`v${formatVersion(startTag)}`);
  console.log(
    JSON.stringify(await fetchPullRequestsMergedSince(sinceIsoTime), null, 2),
  );
}

function checkAgreement(tagName: string, isPrereleaseText: string) {
  const versionMismatches = findVersionMismatches(
    readVersionInCode(),
    tagName,
    isPrereleaseText === "true",
  );
  if (versionMismatches.length > 0) {
    fail(versionMismatches.join("\n"));
  }
  console.log(`${tagName} agrees with the code.`);
}

const publicationWorkflows: PublicationWorkflow[] = [
  "beta-publish",
  "stable-promote",
  "stable-publish",
];
const [command, firstArgument, secondArgument] = process.argv.slice(2);
switch (command) {
  case "readiness":
    await checkReadiness();
    break;
  case "decide":
    decide(
      publicationWorkflows.includes(firstArgument as PublicationWorkflow)
        ? (firstArgument as PublicationWorkflow)
        : fail(`Choose a workflow: ${publicationWorkflows.join(", ")}`),
    );
    break;
  case "merged-pull-requests":
    await printMergedPullRequests(secondArgument ?? firstArgument);
    break;
  case "agreement":
    checkAgreement(firstArgument ?? "", secondArgument ?? "");
    break;
  case "release-number":
    console.log(findNextReleaseNumber(readTagNames()));
    break;
  default:
    fail(
      "Usage: bun scripts/release/release.ts readiness|decide <workflow>|merged-pull-requests --since last-tag|last-stable|agreement <tag> <is-prerelease>|release-number",
    );
}
