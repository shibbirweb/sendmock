import { readFileSync } from "node:fs";

import { parseDownloadSources } from "./download-activity-cache";
import type { DownloadSources } from "./download-sources";
import { fetchDownloadSources } from "./fetch-download-sources";

/** crates.io refuses requests without a User-Agent that names the client. */
const buildUserAgent =
  "sendmock-website (https://github.com/shibbirweb/sendmock)";
const buildRequestTimeoutMs = 5000;

async function fetchJsonAtBuild(url: string): Promise<unknown> {
  const registryResponse = await fetch(url, {
    headers: { "User-Agent": buildUserAgent },
    signal: AbortSignal.timeout(buildRequestTimeoutMs),
    cache: "force-cache",
  });
  return registryResponse.ok ? registryResponse.json() : null;
}

/** The test build reads a fixture file instead, so its numbers never depend on the network. */
function readSourcesFile(sourcesFilePath: string): DownloadSources {
  try {
    return (
      parseDownloadSources(JSON.parse(readFileSync(sourcesFilePath, "utf8"))) ??
      {}
    );
  } catch {
    return {};
  }
}

/**
 * Every source's days, read once while the site is built and written into the pages, so the
 * wordmark shows real numbers on first paint. A source that cannot be read is left out, and
 * with none the build still succeeds. Every deploy reads them again.
 */
export async function loadBuildDownloadSources(): Promise<DownloadSources> {
  const sourcesFilePath = process.env.DOWNLOAD_ACTIVITY_SOURCES_FILE ?? "";
  if (sourcesFilePath) {
    return readSourcesFile(sourcesFilePath);
  }
  return fetchDownloadSources(fetchJsonAtBuild, new Date());
}
