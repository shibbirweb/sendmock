#!/usr/bin/env bun
/**
 * Rust source file size (AGENTS.md, Code style).
 *
 *     bun scripts/rust-file-lines.ts
 *
 * Counts each crate source file up to its `#[cfg(test)]` module, so unit tests do not
 * count; integration tests under `tests/` are skipped. Fails above the hard limit and
 * lists the files that passed the soft limit and should be split.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repositoryRoot = join(import.meta.dir, "..");
const cratesDirectory = join(repositoryRoot, "crates");

export const softLimitLines = 300;
export const hardLimitLines = 500;

const skippedDirectoryNames = new Set(["tests", "fixtures", "target"]);

/** Lines before the first `#[cfg(test)]`, which starts the unit test module. */
export function countProductionLines(rustSource: string): number {
  const lines = rustSource.split("\n");
  const testModuleStart = lines.findIndex(
    (line) => line.trim() === "#[cfg(test)]",
  );
  const productionLines =
    testModuleStart === -1 ? lines : lines.slice(0, testModuleStart);
  while (productionLines.at(-1)?.trim() === "") {
    productionLines.pop();
  }
  return productionLines.length;
}

export type FileLineCount = { filePath: string; productionLines: number };

export function classifyFileLineCounts(fileLineCounts: FileLineCount[]) {
  return {
    filesOverHardLimit: fileLineCounts.filter(
      (fileLineCount) => fileLineCount.productionLines > hardLimitLines,
    ),
    filesOverSoftLimit: fileLineCounts.filter(
      (fileLineCount) =>
        fileLineCount.productionLines > softLimitLines &&
        fileLineCount.productionLines <= hardLimitLines,
    ),
  };
}

function listRustSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return skippedDirectoryNames.has(entry.name)
        ? []
        : listRustSourceFiles(entryPath);
    }
    return entry.name.endsWith(".rs") ? [entryPath] : [];
  });
}

export function readWorkspaceFileLineCounts(): FileLineCount[] {
  return listRustSourceFiles(cratesDirectory).map((filePath) => ({
    filePath: relative(repositoryRoot, filePath),
    productionLines: countProductionLines(readFileSync(filePath, "utf8")),
  }));
}

if (import.meta.main) {
  const { filesOverHardLimit, filesOverSoftLimit } = classifyFileLineCounts(
    readWorkspaceFileLineCounts(),
  );
  for (const { filePath, productionLines } of filesOverSoftLimit) {
    console.warn(
      `${filePath}: ${productionLines} lines, over ${softLimitLines}; split it`,
    );
  }
  for (const { filePath, productionLines } of filesOverHardLimit) {
    console.error(
      `${filePath}: ${productionLines} lines, over the ${hardLimitLines}-line limit`,
    );
  }
  if (filesOverHardLimit.length > 0) {
    process.exit(1);
  }
  console.log(`Every Rust source file is within ${hardLimitLines} lines.`);
}
