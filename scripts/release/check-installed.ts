#!/usr/bin/env bun
/**
 * Runs test cases 2 to 8 against the `sendmock` a channel installed (DS-03.6).
 *
 *     bun scripts/release/check-installed.ts <path or command on the PATH> <version> <channel>
 */

import { existsSync } from "node:fs";

import { runInstalledBinaryChecks } from "./installed-binary-checks";

const [commandOrPath, expectedVersion, expectedChannel] = process.argv.slice(2);
if (!commandOrPath || !expectedVersion || !expectedChannel) {
  console.error(
    "Usage: bun scripts/release/check-installed.ts <path or command> <version> <channel>",
  );
  process.exit(2);
}
const binaryPath = existsSync(commandOrPath)
  ? commandOrPath
  : Bun.which(commandOrPath);
if (binaryPath === null) {
  console.log(
    `::error title=Installed binary::${commandOrPath} is not on the PATH`,
  );
  process.exit(1);
}
try {
  await runInstalledBinaryChecks(binaryPath, expectedVersion, expectedChannel);
} catch (failedCheck) {
  console.log(
    `::error title=Installed binary ${binaryPath}::${(failedCheck as Error).message}`,
  );
  process.exit(1);
}
