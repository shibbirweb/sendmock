#!/usr/bin/env bun
/**
 * Waits until the registries that Install channels' `after-publish` run installs from serve a
 * release (#370), so Registry publish can start that run by itself: npm (published by Registry
 * publish), our APT and YUM repository (rebuilt by the website deploy that runs beside it; one
 * deploy writes both, so the APT index stands for the two) and, for a stable, crates.io (sent
 * from a hand-started run of Registry publish). Homebrew, Scoop, Docker and the archives are out
 * before Registry publish starts. After the wait limit it names what is still missing and
 * returns, so Install channels still runs and shows each channel's real result.
 *
 *     bun scripts/release/published-channels.ts <version> <beta|stable> [--with-crates]
 */
import { buildRegistryPackageUrl } from "./npm-publish";

const pollIntervalMs = 30_000;
const waitLimitMs = 60 * 60_000;
const packageRepositoryUrl = "https://shibbir.me/sendmock/packages";
// crates.io refuses requests without a User-Agent naming the client.
const cratesRequestHeaders = { "User-Agent": "sendmock-release-workflow" };

export type ReleaseChannel = "beta" | "stable";

type FetchUrl = (url: string, init?: RequestInit) => Promise<Response>;
type Sleep = (durationMs: number) => Promise<void>;

export type PublishedChannelCheck = {
  label: string;
  url: string;
  requestInit?: RequestInit;
  isServed: (response: Response) => Promise<boolean>;
};

const sleepFor: Sleep = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

/** Debian sorts `~` before anything, so nfpm writes `1.4.1-beta.1` as `1.4.1~beta.1`. */
export function buildDebianVersion(version: string): string {
  return version.replace("-", "~");
}

export function listPublishedChannelChecks(
  version: string,
  releaseChannel: ReleaseChannel,
  hasCrates: boolean,
): PublishedChannelCheck[] {
  const debianVersionLine = `Version: ${buildDebianVersion(version)}\n`;
  const checks: PublishedChannelCheck[] = [
    {
      label: `npm sendmock@${version}`,
      url: `${buildRegistryPackageUrl("sendmock")}/${encodeURIComponent(version)}`,
      isServed: async (response) => response.ok,
    },
    {
      label: `the ${releaseChannel} APT and YUM repository`,
      url: `${packageRepositoryUrl}/apt/dists/${releaseChannel}/main/binary-amd64/Packages`,
      isServed: async (response) => response.ok && (await response.text()).includes(debianVersionLine),
    },
  ];
  if (releaseChannel === "stable" && hasCrates) {
    checks.push({
      label: `crates.io sendmock ${version}`,
      url: `https://crates.io/api/v1/crates/sendmock/${encodeURIComponent(version)}`,
      requestInit: { headers: cratesRequestHeaders },
      isServed: async (response) => response.ok,
    });
  }
  return checks;
}

async function isChannelServed(check: PublishedChannelCheck, fetchUrl: FetchUrl): Promise<boolean> {
  try {
    return await check.isServed(await fetchUrl(check.url, check.requestInit));
  } catch {
    return false;
  }
}

/** Polls every check until all serve the release or the limit passes; returns the missing labels. */
export async function waitForPublishedChannels(
  checks: PublishedChannelCheck[],
  fetchUrl: FetchUrl = fetch,
  sleep: Sleep = sleepFor,
  limitMs: number = waitLimitMs,
): Promise<string[]> {
  let pendingChecks = checks;
  for (let waitedMs = 0; ; waitedMs += pollIntervalMs) {
    const servedResults = await Promise.all(
      pendingChecks.map((check) => isChannelServed(check, fetchUrl)),
    );
    pendingChecks = pendingChecks.filter((_, checkIndex) => !servedResults[checkIndex]);
    if (pendingChecks.length === 0 || waitedMs >= limitMs) {
      return pendingChecks.map((check) => check.label);
    }
    console.log(`Not served yet: ${pendingChecks.map((check) => check.label).join(", ")}; checking again in 30 seconds.`);
    await sleep(pollIntervalMs);
  }
}

if (import.meta.main) {
  const [version, releaseChannel] = process.argv.slice(2);
  if (version === undefined || (releaseChannel !== "beta" && releaseChannel !== "stable")) {
    console.error("Usage: bun scripts/release/published-channels.ts <version> <beta|stable> [--with-crates]");
    process.exit(2);
  }
  const checks = listPublishedChannelChecks(version, releaseChannel, process.argv.includes("--with-crates"));
  const missingLabels = await waitForPublishedChannels(checks);
  if (missingLabels.length === 0) {
    console.log(`Every after-publish registry serves ${version}.`);
  } else {
    console.log(`::warning::Still not served after ${waitLimitMs / 60_000} minutes: ${missingLabels.join(", ")}. Starting Install channels anyway, so it shows each channel's result.`);
  }
}
