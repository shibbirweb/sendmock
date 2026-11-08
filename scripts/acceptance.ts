#!/usr/bin/env bun
/**
 * Acceptance criteria traceability (docs/plan/acceptance/README.md).
 *
 *     bun scripts/acceptance.ts            report per feature, fail on problems
 *     bun scripts/acceptance.ts --summary  only the totals
 *
 * Fails when a test names a criterion ID that does not exist, when a feature
 * marked "Accepted" has a criterion that no test names, or when the README's
 * status line disagrees with the acceptance files.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repositoryRoot = join(import.meta.dir, "..");
const acceptanceDirectory = join(repositoryRoot, "docs/plan/acceptance");
// The examples' SDK checks run in CI against a release binary, so they prove criteria too.
const testRoots = [
  "web/src",
  "web/tests",
  "website",
  "crates",
  "scripts",
  "examples",
];
const testFilePattern =
  /(\.test\.tsx?|\.spec\.ts|_test\.rs|\.rs|-test\.sh|done-when\.js|verify\.php|verify\.py)$/;
const ignoredDirectoryNames = new Set(["node_modules", "dist", "target", ".git"]);
// Its fixtures use real criterion IDs as sample data, not as proof.
const ignoredFileNames = new Set(["acceptance.test.ts"]);

export const criterionIdPattern = /\b([A-Z]{2}-\d{2}\.\d+)\b/g;

export type AcceptanceFeature = {
  featureId: string;
  featureName: string;
  status: string;
  criterionIds: string[];
};

/** Reads every "## XX-00 Name" section and its "- [ ] XX-00.N" criteria. */
export function parseAcceptanceFile(fileContent: string): AcceptanceFeature[] {
  const features: AcceptanceFeature[] = [];
  let currentFeature: AcceptanceFeature | null = null;

  for (const line of fileContent.split("\n")) {
    const featureHeading = line.match(/^## ([A-Z]{2}-\d{2}) (.+)$/);
    if (featureHeading) {
      currentFeature = {
        featureId: featureHeading[1] ?? "",
        featureName: (featureHeading[2] ?? "").trim(),
        status: "Not started",
        criterionIds: [],
      };
      features.push(currentFeature);
      continue;
    }

    const criterionLine = line.match(/^- \[[ x]\] ([A-Z]{2}-\d{2}\.\d+) /);
    if (criterionLine && currentFeature) {
      currentFeature.criterionIds.push(criterionLine[1] ?? "");
    }
  }

  return features;
}

/** How many criteria of an acceptance file are ticked (`- [x]`). */
export function countTickedCriteria(fileContent: string): number {
  return [...fileContent.matchAll(/^- \[x\] [A-Z]{2}-\d{2}\.\d+ /gm)].length;
}

export type StatusTotals = {
  acceptedFeatureCount: number;
  featureCount: number;
  tickedCriterionCount: number;
  criterionCount: number;
};

/** The README's status line, as it must read for the given totals. */
export function formatStatusLine(totals: StatusTotals): string {
  return `**Accepted: ${totals.acceptedFeatureCount} / ${totals.featureCount} features, ${totals.tickedCriterionCount} / ${totals.criterionCount} criteria ticked.**`;
}

/** The README's status line (the bold line under `## Status`), or null when it has none. */
export function readStatusLine(readmeContent: string): string | null {
  return readmeContent.match(/^\*\*Accepted: .+?\*\*/m)?.[0] ?? null;
}

/** Reads feature statuses from the README status table. */
export function parseFeatureStatuses(readmeContent: string): Map<string, string> {
  const featureStatuses = new Map<string, string>();

  for (const line of readmeContent.split("\n")) {
    const statusRow = line.match(/^\| \[([A-Z]{2}-\d{2})\]\([^)]*\) \|.*\| ([^|]+) \|$/);
    if (statusRow) {
      featureStatuses.set(statusRow[1] ?? "", (statusRow[2] ?? "").trim());
    }
  }

  return featureStatuses;
}

function listTestFiles(directoryPath: string): string[] {
  let directoryEntries: string[];
  try {
    directoryEntries = readdirSync(directoryPath);
  } catch {
    return [];
  }

  return directoryEntries.flatMap((entryName) => {
    if (ignoredDirectoryNames.has(entryName) || ignoredFileNames.has(entryName)) {
      return [];
    }

    const entryPath = join(directoryPath, entryName);
    if (statSync(entryPath).isDirectory()) {
      return listTestFiles(entryPath);
    }

    return testFilePattern.test(entryName) ? [entryPath] : [];
  });
}

/** Maps each criterion ID to the test files that name it. */
export function collectCriterionReferences(
  testFileContents: { filePath: string; fileContent: string }[],
): Map<string, Set<string>> {
  const referencesByCriterionId = new Map<string, Set<string>>();

  for (const { filePath, fileContent } of testFileContents) {
    for (const criterionMatch of fileContent.matchAll(criterionIdPattern)) {
      const criterionId = criterionMatch[1] ?? "";
      const referencingFiles = referencesByCriterionId.get(criterionId) ?? new Set<string>();
      referencingFiles.add(filePath);
      referencesByCriterionId.set(criterionId, referencingFiles);
    }
  }

  return referencesByCriterionId;
}

/** Each criterion ID named by a test in the repository, with the files that name it. */
export function readCriterionReferences(): Map<string, Set<string>> {
  const testFileContents = testRoots
    .flatMap((testRoot) => listTestFiles(join(repositoryRoot, testRoot)))
    .map((filePath) => ({
      filePath: relative(repositoryRoot, filePath),
      fileContent: readFileSync(filePath, "utf8"),
    }));
  return collectCriterionReferences(testFileContents);
}

function runAcceptanceCheck(isSummaryOnly: boolean): number {
  const readmeContent = readFileSync(join(acceptanceDirectory, "README.md"), "utf8");
  const featureStatuses = parseFeatureStatuses(readmeContent);
  const acceptanceFileContents = readdirSync(acceptanceDirectory)
    .filter((fileName) => /^\d\d-.+\.md$/.test(fileName))
    .map((fileName) => readFileSync(join(acceptanceDirectory, fileName), "utf8"));
  const features = acceptanceFileContents
    .flatMap((fileContent) => parseAcceptanceFile(fileContent))
    .map((feature) => ({
      ...feature,
      status: featureStatuses.get(feature.featureId) ?? feature.status,
    }));

  const referencesByCriterionId = readCriterionReferences();
  const knownCriterionIds = new Set(features.flatMap((feature) => feature.criterionIds));
  const problems: string[] = [];

  for (const [criterionId, referencingFiles] of referencesByCriterionId) {
    if (!knownCriterionIds.has(criterionId)) {
      problems.push(`Unknown criterion ${criterionId} named in ${[...referencingFiles].join(", ")}`);
    }
  }

  let provenCriterionCount = 0;
  for (const feature of features) {
    const provenIds = feature.criterionIds.filter((criterionId) =>
      referencesByCriterionId.has(criterionId),
    );
    provenCriterionCount += provenIds.length;
    const unprovenIds = feature.criterionIds.filter((criterionId) => !provenIds.includes(criterionId));

    if (feature.status === "Accepted" && unprovenIds.length > 0) {
      problems.push(`${feature.featureId} is Accepted but has no test for ${unprovenIds.join(", ")}`);
    }
    if (!isSummaryOnly && provenIds.length > 0) {
      console.log(
        `${feature.featureId} ${feature.featureName}: ${provenIds.length}/${feature.criterionIds.length} criteria have tests (${feature.status})`,
      );
    }
  }

  const acceptedFeatureCount = features.filter((feature) => feature.status === "Accepted").length;
  const expectedStatusLine = formatStatusLine({
    acceptedFeatureCount,
    featureCount: features.length,
    tickedCriterionCount: acceptanceFileContents.reduce(
      (tickedCount, fileContent) => tickedCount + countTickedCriteria(fileContent),
      0,
    ),
    criterionCount: knownCriterionIds.size,
  });
  if (readStatusLine(readmeContent) !== expectedStatusLine) {
    problems.push(`the README's status line should read: ${expectedStatusLine}`);
  }
  console.log(
    `\nAccepted features: ${acceptedFeatureCount}/${features.length}. Criteria with tests: ${provenCriterionCount}/${knownCriterionIds.size}.`,
  );

  for (const problem of problems) {
    console.error(`error: ${problem}`);
  }

  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(runAcceptanceCheck(process.argv.includes("--summary")));
}
