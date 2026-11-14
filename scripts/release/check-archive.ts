#!/usr/bin/env bun
/**
 * Tests one release archive on the operating system and CPU it is built for, before
 * anything is published (docs/plan/09-distribution.md, Binary tests on every platform).
 *
 *     bun scripts/release/check-archive.ts <archive> <version> <channel>
 *
 * Checks the checksum and the layout (case 1), then runs cases 2 to 8 on the unpacked binary
 * (installed-binary-checks.ts). Linux container checks (alpine, busybox) run in the workflow.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { check } from "../binary-smoke-test";
import { hasZipSignature, readTarCommand } from "./archive-tool";
import { runInstalledBinaryChecks } from "./installed-binary-checks";

function runTar(tarArguments: string[]): string {
  const tarResult = Bun.spawnSync([readTarCommand(), ...tarArguments]);
  if (tarResult.exitCode !== 0) {
    throw new Error(
      `tar ${tarArguments.join(" ")}: ${tarResult.stderr.toString()}`,
    );
  }
  return tarResult.stdout.toString();
}

function checkChecksum(archivePath: string) {
  const expectedChecksum = readFileSync(`${archivePath}.sha256`, "utf8").split(
    /\s+/,
  )[0];
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(readFileSync(archivePath));
  check(hasher.digest("hex") === expectedChecksum, "the checksum matches");
}

function checkLayout(archivePath: string, binaryName: string) {
  const entryNames = runTar(["-tf", archivePath])
    .split("\n")
    .map((entryName) => entryName.trim().replace(/^\.\//, ""))
    .filter((entryName) => entryName !== "" && entryName !== ".")
    .sort();
  const expectedNames = [
    binaryName,
    "LICENSE-APACHE",
    "LICENSE-MIT",
    "README.md",
  ].sort();
  check(
    JSON.stringify(entryNames) === JSON.stringify(expectedNames),
    `the archive holds ${expectedNames.join(", ")} at its top level`,
  );
}

async function main() {
  const [archivePath, expectedVersion, expectedChannel] = process.argv.slice(2);
  if (!archivePath || !expectedVersion || !expectedChannel) {
    console.error(
      "Usage: bun scripts/release/check-archive.ts <archive> <version> <channel>",
    );
    process.exit(2);
  }
  const binaryName = basename(archivePath).includes("windows")
    ? "sendmock.exe"
    : "sendmock";
  checkChecksum(archivePath);
  if (archivePath.endsWith(".zip")) {
    check(
      hasZipSignature(readFileSync(archivePath)),
      "the archive is a real zip file, as Expand-Archive and Scoop need",
    );
  }
  checkLayout(archivePath, binaryName);
  const extractDirectory = mkdtempSync(join(tmpdir(), "sendmock-archive-"));
  runTar(["-xf", archivePath, "-C", extractDirectory]);
  const binaryPath = join(extractDirectory, binaryName);
  await runInstalledBinaryChecks(binaryPath, expectedVersion, expectedChannel);
}

await main();
