import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAcceptanceFile, parseFeatureStatuses } from "../acceptance";

const repositoryRoot = join(import.meta.dir, "../..");
const workflowsDirectory = join(repositoryRoot, ".github/workflows");
const acceptanceDirectory = join(repositoryRoot, "docs/plan/acceptance");
export const runbookPath = join(repositoryRoot, "docs/plan/31-release-runbook.md");

export type WorkflowSetting = {
  name: string;
  kind: "secret" | "variable";
  workflowFiles: string[];
};

export type RunbookStep = {
  stepNumber: number;
  title: string;
  body: string;
  provenCriterionIds: string[];
};

/** Every secret and variable a workflow reads, with the workflows that read it. */
export function listWorkflowSettings(): WorkflowSetting[] {
  const settingsByName = new Map<string, WorkflowSetting>();
  const workflowFiles = readdirSync(workflowsDirectory).filter((fileName) =>
    fileName.endsWith(".yml"),
  );
  for (const workflowFile of workflowFiles) {
    const workflowText = readFileSync(join(workflowsDirectory, workflowFile), "utf8");
    for (const settingMatch of workflowText.matchAll(/\b(secrets|vars)\.([A-Z][A-Z0-9_]*)/g)) {
      const name = settingMatch[2] ?? "";
      if (name === "GITHUB_TOKEN") {
        continue;
      }
      const setting = settingsByName.get(name) ?? {
        name,
        kind: settingMatch[1] === "vars" ? "variable" : "secret",
        workflowFiles: [],
      };
      if (!setting.workflowFiles.includes(workflowFile)) {
        setting.workflowFiles.push(workflowFile);
      }
      settingsByName.set(name, setting);
    }
  }
  return [...settingsByName.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

/** The runbook's `## N. Title` steps, each with the criteria its `Proves:` line names. */
export function parseRunbookSteps(runbookText: string): RunbookStep[] {
  const stepSections = runbookText.split(/^(?=## \d+\. )/m).slice(1);
  return stepSections.map((stepSection) => {
    const headingMatch = stepSection.match(/^## (\d+)\. (.+)$/m);
    const provesLine = stepSection.match(/^Proves: (.+)$/m)?.[1] ?? "";
    return {
      stepNumber: Number(headingMatch?.[1] ?? 0),
      title: (headingMatch?.[2] ?? "").trim(),
      body: stepSection,
      provenCriterionIds: [...provesLine.matchAll(/[A-Z]{2}-\d{2}\.\d+/g)].map(
        (criterionMatch) => criterionMatch[0],
      ),
    };
  });
}

export function readRunbookSteps(): RunbookStep[] {
  return parseRunbookSteps(readFileSync(runbookPath, "utf8"));
}

function listAcceptanceFiles(): string[] {
  return readdirSync(acceptanceDirectory).filter(
    (fileName) => fileName.endsWith(".md") && fileName !== "README.md",
  );
}

/** Every `- [ ] XX-00.N` criterion still open in `docs/plan/acceptance/`. */
export function listUntickedCriterionIds(): string[] {
  return listAcceptanceFiles().flatMap((fileName) =>
    [
      ...readFileSync(join(acceptanceDirectory, fileName), "utf8").matchAll(
        /^- \[ \] ([A-Z]{2}-\d{2}\.\d+) /gm,
      ),
    ].map((criterionMatch) => criterionMatch[1] ?? ""),
  );
}

/** Features whose status in the acceptance README is not `Accepted`, with that status. */
export function listFeaturesNotAccepted(): { featureId: string; status: string }[] {
  const featureStatuses = parseFeatureStatuses(
    readFileSync(join(acceptanceDirectory, "README.md"), "utf8"),
  );
  return listAcceptanceFiles()
    .flatMap((fileName) =>
      parseAcceptanceFile(readFileSync(join(acceptanceDirectory, fileName), "utf8")),
    )
    .map((feature) => ({
      featureId: feature.featureId,
      status: featureStatuses.get(feature.featureId) ?? "Not started",
    }))
    .filter((feature) => feature.status !== "Accepted");
}
