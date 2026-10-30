#!/usr/bin/env bun
/**
 * Tests one release archive on the operating system and CPU it is built for, before
 * anything is published (docs/plan/09-distribution.md, Binary tests on every platform).
 *
 *     bun scripts/release/check-archive.ts <archive> <version> <channel>
 *
 * Checks the checksum and the layout, the version and channel, that the binary starts
 * with no runtime installed and listens on 127.0.0.1 only, the API and the embedded UI,
 * and a clean stop. Linux container checks (alpine, busybox) run in the workflow.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  check,
  checkRunningBinary,
  startSendmock,
  stopSendmock,
} from "../binary-smoke-test";

function runTar(tarArguments: string[]): string {
  const tarResult = Bun.spawnSync(["tar", ...tarArguments]);
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

function checkVersion(
  binaryPath: string,
  expectedVersion: string,
  expectedChannel: string,
) {
  const versionResult = Bun.spawnSync([binaryPath, "version", "--json"]);
  const reportedVersion = JSON.parse(versionResult.stdout.toString()) as {
    version: string;
    channel: string;
  };
  check(
    reportedVersion.version === expectedVersion &&
      reportedVersion.channel === expectedChannel,
    `sendmock version reports ${expectedVersion} (${expectedChannel})`,
  );
}

async function checkDefaultListeners(binaryPath: string) {
  const runningSendmock = await startSendmock(binaryPath, ["--db", "memory"]);
  const exitCode = await stopSendmock(runningSendmock);
  check(
    runningSendmock.httpAddress === "127.0.0.1:8025",
    "it listens on 127.0.0.1:8025 by default",
  );
  check(
    runningSendmock.smtpAddress === "127.0.0.1:1025",
    "it takes SMTP on 127.0.0.1:1025 by default",
  );
  if (process.platform !== "win32") {
    check(exitCode === 0, "SIGTERM stops it with exit code 0");
  }
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
  checkLayout(archivePath, binaryName);
  const extractDirectory = mkdtempSync(join(tmpdir(), "sendmock-archive-"));
  runTar(["-xf", archivePath, "-C", extractDirectory]);
  const binaryPath = join(extractDirectory, binaryName);
  checkVersion(binaryPath, expectedVersion, expectedChannel);
  await checkDefaultListeners(binaryPath);
  const runningSendmock = await startSendmock(binaryPath, [
    "--http-addr",
    "127.0.0.1:0",
    "--smtp-addr",
    "127.0.0.1:0",
    "--db",
    "memory",
  ]);
  try {
    await checkRunningBinary(`http://${runningSendmock.httpAddress}`);
  } finally {
    await stopSendmock(runningSendmock);
  }
}

await main();
