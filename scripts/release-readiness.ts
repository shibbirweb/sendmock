/**
 * What is still open before the 1.0 release (docs/plan/31-release-runbook.md): the secrets and
 * variables the workflows read that the repository does not have, the features that are not
 * Accepted, and each unticked criterion with the runbook step that proves it. Needs `gh` logged in.
 *
 *     bun scripts/release-readiness.ts
 */
import {
  listFeaturesNotAccepted,
  listUntickedCriterionIds,
  listWorkflowSettings,
  readRunbookSteps,
} from "./release/release-readiness-sources";

const repository = "shibbirweb/sendmock";

async function listRepositoryNames(kind: "secret" | "variable"): Promise<Set<string>> {
  const listing = Bun.spawnSync(["gh", kind, "list", "--repo", repository, "--json", "name"]);
  if (listing.exitCode !== 0) {
    throw new Error(`gh ${kind} list failed: ${listing.stderr.toString().trim()}`);
  }
  const entries = JSON.parse(listing.stdout.toString() || "[]") as { name: string }[];
  return new Set(entries.map((entry) => entry.name));
}

const setNames = new Set([
  ...(await listRepositoryNames("secret")),
  ...(await listRepositoryNames("variable")),
]);
const missingSettings = listWorkflowSettings().filter((setting) => !setNames.has(setting.name));
console.log(`Secrets and variables not set (${missingSettings.length}):`);
for (const setting of missingSettings) {
  console.log(`  ${setting.kind} ${setting.name}, read by ${setting.workflowFiles.join(", ")}`);
}

const featuresNotAccepted = listFeaturesNotAccepted();
console.log(`\nFeatures not Accepted (${featuresNotAccepted.length}):`);
for (const feature of featuresNotAccepted) {
  console.log(`  ${feature.featureId}: ${feature.status}`);
}

const runbookSteps = readRunbookSteps();
const untickedCriterionIds = listUntickedCriterionIds();
console.log(`\nUnticked criteria (${untickedCriterionIds.length}):`);
for (const criterionId of untickedCriterionIds) {
  const provingStep = runbookSteps.find((step) => step.provenCriterionIds.includes(criterionId));
  const stepText = provingStep
    ? `step ${provingStep.stepNumber}, ${provingStep.title}`
    : "no runbook step, proven in CI";
  console.log(`  ${criterionId}: ${stepText}`);
}
