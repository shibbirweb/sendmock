#!/usr/bin/env bun
/**
 * Rust line coverage gate (AGENTS.md, CI enforcement).
 *
 *     cargo llvm-cov nextest --workspace --json --summary-only --output-path coverage.json
 *     bun scripts/rust-coverage.ts coverage.json
 *
 * Fails below 80% of lines overall or 90% in the operations and domain crates, and
 * writes a per-crate table to the GitHub job summary when it runs in Actions.
 */

import { appendFileSync, readFileSync } from "node:fs";

export const overallMinimumPercent = 80;
export const strictMinimumPercent = 90;
export const strictCrateNames = new Set([
  "sendmock-ops",
  "sendmock-sms",
  "sendmock-webhooks",
]);

type LlvmCovSummary = {
  data?: {
    files?: {
      filename?: string;
      summary?: { lines?: { count?: number; covered?: number } };
    }[];
  }[];
};

export type CrateCoverage = {
  crateName: string;
  lineCount: number;
  coveredLineCount: number;
};

export function percentOf(coveredLineCount: number, lineCount: number): number {
  return lineCount === 0 ? 100 : (coveredLineCount / lineCount) * 100;
}

/** Sums the line counts of each `crates/<name>/` folder in an llvm-cov JSON summary. */
export function summariseCoverageByCrate(
  llvmCovSummary: LlvmCovSummary,
): CrateCoverage[] {
  const coverageByCrate = new Map<string, CrateCoverage>();
  for (const file of llvmCovSummary.data?.[0]?.files ?? []) {
    const crateName = file.filename?.match(/crates[\\/]([^\\/]+)[\\/]/)?.[1];
    if (!crateName) {
      continue;
    }
    const crateCoverage = coverageByCrate.get(crateName) ?? {
      crateName,
      lineCount: 0,
      coveredLineCount: 0,
    };
    crateCoverage.lineCount += file.summary?.lines?.count ?? 0;
    crateCoverage.coveredLineCount += file.summary?.lines?.covered ?? 0;
    coverageByCrate.set(crateName, crateCoverage);
  }
  return [...coverageByCrate.values()].sort((first, second) =>
    first.crateName.localeCompare(second.crateName),
  );
}

export function findCoverageFailures(
  crateCoverages: CrateCoverage[],
): string[] {
  const failures: string[] = [];
  const totalLineCount = crateCoverages.reduce(
    (sum, crate) => sum + crate.lineCount,
    0,
  );
  const totalCoveredLineCount = crateCoverages.reduce(
    (sum, crate) => sum + crate.coveredLineCount,
    0,
  );
  const overallPercent = percentOf(totalCoveredLineCount, totalLineCount);
  if (overallPercent < overallMinimumPercent) {
    failures.push(
      `Overall line coverage is ${overallPercent.toFixed(1)}%, below ${overallMinimumPercent}%`,
    );
  }
  for (const crate of crateCoverages) {
    const cratePercent = percentOf(crate.coveredLineCount, crate.lineCount);
    if (
      strictCrateNames.has(crate.crateName) &&
      cratePercent < strictMinimumPercent
    ) {
      failures.push(
        `${crate.crateName} line coverage is ${cratePercent.toFixed(1)}%, below ${strictMinimumPercent}%`,
      );
    }
  }
  return failures;
}

function renderSummaryTable(crateCoverages: CrateCoverage[]): string {
  const rows = crateCoverages.map((crate) => {
    const minimumPercent = strictCrateNames.has(crate.crateName)
      ? strictMinimumPercent
      : overallMinimumPercent;
    return `| ${crate.crateName} | ${crate.coveredLineCount} / ${crate.lineCount} | ${percentOf(crate.coveredLineCount, crate.lineCount).toFixed(1)}% | ${minimumPercent}% |`;
  });
  return [
    "## Rust line coverage",
    "",
    "| Crate | Lines covered | Coverage | Minimum |",
    "|-------|---------------|----------|---------|",
    ...rows,
    "",
  ].join("\n");
}

if (import.meta.main) {
  const summaryPath = process.argv[2];
  if (!summaryPath) {
    console.error(
      "Usage: bun scripts/rust-coverage.ts <llvm-cov summary JSON>",
    );
    process.exit(2);
  }
  const crateCoverages = summariseCoverageByCrate(
    JSON.parse(readFileSync(summaryPath, "utf8")),
  );
  const summaryTable = renderSummaryTable(crateCoverages);
  console.log(summaryTable);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryTable);
  }
  const failures = findCoverageFailures(crateCoverages);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
}
