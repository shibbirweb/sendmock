#!/usr/bin/env bun
/**
 * Publishes server.json to the MCP registry once npm serves the release (#355). The MCP registry
 * checks that the `sendmock` npm package has the version, and npm does not serve a version the
 * moment it is published, so the first try used to fail with "was not found". This waits until
 * registry.npmjs.org answers for the version, then publishes, trying again only on that answer,
 * since the MCP registry may read npm through a cache that is a moment behind.
 *
 *     bun scripts/release/mcp-registry-publish.ts <version>
 */
import { spawnSync } from "node:child_process";

import { buildRegistryPackageUrl } from "./npm-publish";

const npmPackageName = "sendmock";
const npmPollIntervalMs = 30_000;
const npmWaitLimitMs = 30 * 60_000;
const publishAttemptCount = 4;
const publishRetryDelayMs = 60_000;
const npmVersionMissingMessage = "was not found";

type FetchVersion = (versionUrl: string) => Promise<Response>;
type Sleep = (durationMs: number) => Promise<void>;
type PublishResult = { exitCode: number; output: string };

const sleepFor: Sleep = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export function buildVersionUrl(packageName: string, version: string): string {
  return `${buildRegistryPackageUrl(packageName)}/${encodeURIComponent(version)}`;
}

/** Waits until npm serves the version; a 404 means not yet, any other failure stops the wait. */
export async function waitForNpmVersion(
  version: string,
  fetchVersion: FetchVersion = fetch,
  sleep: Sleep = sleepFor,
  waitLimitMs: number = npmWaitLimitMs,
): Promise<void> {
  const versionUrl = buildVersionUrl(npmPackageName, version);
  for (let waitedMs = 0; ; waitedMs += npmPollIntervalMs) {
    const versionResponse = await fetchVersion(versionUrl);
    if (versionResponse.ok) {
      console.log(`npm serves ${npmPackageName}@${version}.`);
      return;
    }
    if (versionResponse.status !== 404) {
      throw new Error(`npm answered ${versionResponse.status} for ${versionUrl}.`);
    }
    if (waitedMs >= waitLimitMs) {
      throw new Error(
        `npm still does not serve ${npmPackageName}@${version} after ${waitLimitMs / 60_000} minutes.`,
      );
    }
    console.log(`npm does not serve ${npmPackageName}@${version} yet; checking again in 30 seconds.`);
    await sleep(npmPollIntervalMs);
  }
}

/** Publishes, trying again only while the MCP registry says npm does not have the version yet. */
export async function publishWithRetries(
  publishServer: () => PublishResult,
  sleep: Sleep = sleepFor,
): Promise<void> {
  for (let attempt = 1; attempt <= publishAttemptCount; attempt += 1) {
    const publishResult = publishServer();
    if (publishResult.exitCode === 0) {
      return;
    }
    const isNpmBehind = publishResult.output.includes(npmVersionMissingMessage);
    if (!isNpmBehind || attempt === publishAttemptCount) {
      throw new Error(`mcp-publisher publish failed:\n${publishResult.output}`);
    }
    console.log(`The MCP registry does not see the npm version yet (attempt ${attempt}); trying again in a minute.`);
    await sleep(publishRetryDelayMs);
  }
}

function runMcpPublisherCommand(publisherArguments: string[]): PublishResult {
  const result = spawnSync("mcp-publisher", publisherArguments, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  return { exitCode: result.status ?? 1, output };
}

/** Logs in right before each try, so a long wait for npm never outlasts the registry login. */
function loginAndPublish(): PublishResult {
  const loginResult = runMcpPublisherCommand(["login", "github-oidc"]);
  if (loginResult.exitCode !== 0) {
    return loginResult;
  }
  return runMcpPublisherCommand(["publish", "server.json"]);
}

if (import.meta.main) {
  const version = process.argv[2];
  if (version === undefined || version === "") {
    console.error("Usage: bun scripts/release/mcp-registry-publish.ts <version>");
    process.exit(2);
  }
  await waitForNpmVersion(version);
  await publishWithRetries(loginAndPublish);
}
