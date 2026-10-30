#!/usr/bin/env bun
/**
 * Packs one target's release archive (docs/plan/09-distribution.md, Release archives):
 * `sendmock-<target>.tar.gz`, or `.zip` for Windows, with the binary, the licences and the
 * readme at the top level, and a `.sha256` file next to it.
 *
 *     bun scripts/release/package-archive.ts <target triple> <built binary> <output folder>
 */

import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const repositoryRoot = join(import.meta.dir, "../..");
const includedFiles = ["LICENSE-MIT", "LICENSE-APACHE", "README.md"];

export function archiveFileName(targetTriple: string): string {
  return targetTriple.includes("windows")
    ? `sendmock-${targetTriple}.zip`
    : `sendmock-${targetTriple}.tar.gz`;
}

function main() {
  const [targetTriple, builtBinaryPath, outputDirectory] =
    process.argv.slice(2);
  if (!targetTriple || !builtBinaryPath || !outputDirectory) {
    console.error(
      "Usage: bun scripts/release/package-archive.ts <target triple> <built binary> <output folder>",
    );
    process.exit(2);
  }
  const stagingDirectory = mkdtempSync(join(tmpdir(), "sendmock-package-"));
  const binaryName = basename(builtBinaryPath);
  copyFileSync(builtBinaryPath, join(stagingDirectory, binaryName));
  for (const includedFile of includedFiles) {
    copyFileSync(
      join(repositoryRoot, includedFile),
      join(stagingDirectory, includedFile),
    );
  }
  mkdirSync(outputDirectory, { recursive: true });
  const archiveName = archiveFileName(targetTriple);
  const archivePath = join(outputDirectory, archiveName);
  // bsdtar (macOS, Windows) picks zip from the .zip name with -a; GNU tar on Linux makes the .tar.gz.
  const tarArguments = archiveName.endsWith(".zip")
    ? ["-a", "-cf", archivePath]
    : ["-czf", archivePath];
  const tarResult = Bun.spawnSync([
    "tar",
    ...tarArguments,
    "-C",
    stagingDirectory,
    binaryName,
    ...includedFiles,
  ]);
  if (tarResult.exitCode !== 0) {
    console.error(tarResult.stderr.toString());
    process.exit(1);
  }
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(readFileSync(archivePath));
  writeFileSync(
    `${archivePath}.sha256`,
    `${hasher.digest("hex")}  ${archiveName}\n`,
  );
  console.log(archivePath);
}

if (import.meta.main) {
  main();
}
