/**
 * What is still open before a release (docs/plan/31-release-runbook.md): the secrets and
 * variables the workflows read that the repository does not have, the open code scanning alerts,
 * Dependabot alerts and Dependabot pull requests (PL-19.5), the features that are not Accepted,
 * and each unticked criterion with the runbook step that proves it. Needs `gh` logged in.
 *
 *     bun scripts/release-readiness.ts
 */
import { readCriterionReferences } from "./acceptance";
import { fetchSecurityItems } from "./release/security-items";
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

// The GitHub lookups use the logged-in gh token, which can read the Dependabot alerts too.
const ghToken = Bun.spawnSync(["gh", "auth", "token"]).stdout.toString().trim();
process.env.GITHUB_TOKEN ||= ghToken;
process.env.SECURITY_ALERTS_TOKEN ||= ghToken;
const securityItems = await fetchSecurityItems();
const securityLists: [string, string[]][] = [
  ["Open code scanning alerts on main", securityItems.codeScanningAlerts],
  ["Open Dependabot alerts", securityItems.dependabotAlerts],
  ["Open Dependabot pull requests", securityItems.dependabotPullRequests],
];
for (const [listTitle, openItems] of securityLists) {
  console.log(`\n${listTitle} (${openItems.length}):`);
  for (const openItem of openItems) {
    console.log(`  ${openItem}`);
  }
}

const featuresNotAccepted = listFeaturesNotAccepted();
console.log(`\nFeatures not Accepted (${featuresNotAccepted.length}):`);
for (const feature of featuresNotAccepted) {
  console.log(`  ${feature.featureId}: ${feature.status}`);
}

const runbookSteps = readRunbookSteps();
const untickedCriterionIds = listUntickedCriterionIds();
const criterionReferences = readCriterionReferences();
console.log(`\nUnticked criteria (${untickedCriterionIds.length}):`);
for (const criterionId of untickedCriterionIds) {
  const provingStep = runbookSteps.find((step) => step.provenCriterionIds.includes(criterionId));
  const testCount = criterionReferences.get(criterionId)?.size ?? 0;
  const stepText = provingStep
    ? `step ${provingStep.stepNumber}, ${provingStep.title}`
    : testCount > 0
      ? `ticks when its ${testCount} test files pass in CI`
      : "no runbook step and no test yet";
  console.log(`  ${criterionId}: ${stepText}`);
}
