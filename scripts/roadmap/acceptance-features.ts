// Reads the features, their criteria and statuses from docs/plan/acceptance/.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";

export const repositoryUrl = "https://github.com/shibbirweb/sendmock";
export const branch = "feat/phase-0";
export const blobBase = `${repositoryUrl}/blob/${branch}`;
export const acceptanceFolder = "docs/plan/acceptance";

export type Criterion = {
  id: string;
  text: string;
  isTicked: boolean;
  notes: string[];
};
export type Feature = {
  id: string;
  title: string;
  fileName: string;
  anchor: string;
  introLines: string[];
  criteria: Criterion[];
};
export function toAbsoluteLinks(markdown: string, fromFolder: string): string {
  return markdown
    .replace(/#48\b/g, "pull request 48")
    .replace(/\]\((?!https?:|#)([^)\s]+)\)/g, (_match, target: string) => {
      const [targetPath = "", targetAnchor] = target.split("#");
      const resolvedPath = posix.normalize(posix.join(fromFolder, targetPath));
      return `](${blobBase}/${resolvedPath}${targetAnchor ? `#${targetAnchor}` : ""})`;
    });
}

function toAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/ /g, "-");
}

export function parseFeatures(fileName: string): Feature[] {
  const lines = readFileSync(`${acceptanceFolder}/${fileName}`, "utf8").split(
    "\n",
  );
  const features: Feature[] = [];
  let currentFeature: Feature | null = null;
  for (const line of lines) {
    const headingMatch = line.match(/^## ([A-Z]{2}-\d{2}) (.+)$/);
    if (headingMatch) {
      currentFeature = {
        id: headingMatch[1] ?? "",
        title: headingMatch[2] ?? "",
        fileName,
        anchor: toAnchor(`${headingMatch[1]} ${headingMatch[2]}`),
        introLines: [],
        criteria: [],
      };
      features.push(currentFeature);
      continue;
    }
    if (
      currentFeature === null ||
      line.startsWith("---") ||
      line.startsWith("## ")
    ) {
      if (line.startsWith("## ") || line.startsWith("---")) {
        currentFeature = null;
      }
      continue;
    }
    const criterionMatch = line.match(
      /^- \[( |x)\] ([A-Z]{2}-\d{2}\.\d+) (.+)$/,
    );
    if (criterionMatch) {
      currentFeature.criteria.push({
        id: criterionMatch[2] ?? "",
        text: (criterionMatch[3] ?? "").replace(/ \(#48\)$/, ""),
        isTicked: criterionMatch[1] === "x",
        notes: [],
      });
      continue;
    }
    const noteMatch = line.match(/^ {2}- (.+)$/);
    const lastCriterion = currentFeature.criteria.at(-1);
    if (noteMatch && lastCriterion) {
      lastCriterion.notes.push(noteMatch[1] ?? "");
      continue;
    }
    if (line.trim() !== "" && currentFeature.criteria.length === 0) {
      currentFeature.introLines.push(line.trim());
    }
  }
  return features;
}

export function readStatuses(): Map<string, string> {
  const readme = readFileSync(`${acceptanceFolder}/README.md`, "utf8");
  return new Map(
    [
      ...readme.matchAll(
        /^\| \[([A-Z]{2}-\d{2})\]\([^)]*\) \|.*\| ([^|]+) \|$/gm,
      ),
    ].map((statusMatch) => [
      statusMatch[1] ?? "",
      (statusMatch[2] ?? "").trim(),
    ]),
  );
}

export function listProvingFiles(featureId: string): string[] {
  const pattern = `${featureId.replace("-", "-")}\\.[0-9]`;
  try {
    return execSync(
      `git grep -l -E '${pattern}' -- ':!docs' ':!*.md' ':!CHANGELOG*' ':!scripts/acceptance.ts' ':!scripts/acceptance.test.ts'`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter((filePath) => filePath !== "");
  } catch {
    return [];
  }
}
