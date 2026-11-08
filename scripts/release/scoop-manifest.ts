#!/usr/bin/env bun
/**
 * The Scoop manifest for a release (`sendmock.json` for stable, `sendmock-beta.json` for
 * beta), from the release's SHA256SUMS (DS-03.1). Release build pushes it to the bucket.
 *
 *     bun scripts/release/scoop-manifest.ts <version> <channel> <SHA256SUMS> [download URL]
 *
 * The download URL defaults to the release's GitHub download folder; the release tests pass a
 * local server's address.
 */
import { readFileSync } from "node:fs";

import { parseChecksums } from "./homebrew-formula";

const repositoryUrl = "https://github.com/shibbirweb/sendmock";

/** Scoop's architecture keys and the Windows archive each installs. */
const scoopArchitectures = [
  { key: "64bit", target: "x86_64-pc-windows-msvc" },
  { key: "arm64", target: "aarch64-pc-windows-msvc" },
] as const;

export function readScoopManifestName(channel: string): string {
  return channel === "beta" ? "sendmock-beta" : "sendmock";
}

export function buildScoopManifest(
  version: string,
  channel: string,
  checksums: Map<string, string>,
  downloadUrl = `${repositoryUrl}/releases/download/v${version}`,
): Record<string, unknown> {
  const architecture = Object.fromEntries(
    scoopArchitectures.map(({ key, target }) => {
      const archiveName = `sendmock-${target}.zip`;
      const checksum = checksums.get(archiveName);
      if (checksum === undefined) {
        throw new Error(`SHA256SUMS has no ${archiveName}`);
      }
      return [key, { url: `${downloadUrl}/${archiveName}`, hash: checksum }];
    }),
  );
  const isBeta = channel === "beta";
  const scoopManifest: Record<string, unknown> = {
    version,
    description: isBeta
      ? "SendMock beta: catch email, SMS, payments and webhooks from any app on your machine."
      : "Catch email, SMS, payments and webhooks from any app on your machine.",
    homepage: "https://shibbirweb.github.io/sendmock/",
    // Scoop writes "or" between licences as `|`.
    license: "MIT|Apache-2.0",
    architecture,
    bin: "sendmock.exe",
    notes: "Run `sendmock` and open http://127.0.0.1:8025.",
  };
  // Release build writes every beta; a stable is also found by Scoop's own update check.
  if (!isBeta) {
    scoopManifest.checkver = { github: repositoryUrl };
    scoopManifest.autoupdate = {
      architecture: Object.fromEntries(
        scoopArchitectures.map(({ key, target }) => [
          key,
          {
            url: `${repositoryUrl}/releases/download/v$version/sendmock-${target}.zip`,
          },
        ]),
      ),
      hash: { url: "$baseurl/SHA256SUMS" },
    };
  }
  return scoopManifest;
}

if (import.meta.main) {
  const [version, channel, checksumsPath, downloadUrl] = process.argv.slice(2);
  if (!version || !channel || !checksumsPath) {
    console.error(
      "Usage: bun scripts/release/scoop-manifest.ts <version> <channel> <SHA256SUMS> [download URL]",
    );
    process.exit(2);
  }
  const scoopManifest = buildScoopManifest(
    version,
    channel,
    parseChecksums(readFileSync(checksumsPath, "utf8")),
    downloadUrl,
  );
  process.stdout.write(`${JSON.stringify(scoopManifest, null, 2)}\n`);
}
