// Makes every CI check required on develop and main. The Core Protection ruleset requires each
// check that passed on a pull request's latest commit (every workflow reports all of its jobs on
// every pull request, as no-ops when its paths did not change), and blocks any pull request that
// adds a CodeQL alert. Usage: bun scripts/ci/sync-required-checks.ts <pull request> [--apply]
// (`--apply` needs a repository admin's gh login; without it the change is only printed).
import { spawnSync } from "node:child_process";

const repository = "shibbirweb/sendmock";
const rulesetName = "Core Protection";

type Rule = { type: string; parameters?: Record<string, unknown> };
type Ruleset = { id: number; name: string; rules: Rule[] };
export type CheckRun = { name: string; conclusion: string | null; app: { id: number } };
export type RequiredCheck = { context: string; integration_id: number };

function runGitHubApi(apiArguments: string[], requestBody?: string): string {
  const result = spawnSync("gh", ["api", ...apiArguments], {
    encoding: "utf8",
    input: requestBody,
  });
  if (result.status !== 0) {
    throw new Error(`gh api ${apiArguments.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

/** Each passed check once, sorted; skipped ones (release-only, label-only) are not required. */
export function selectRequiredChecks(checkRuns: CheckRun[]): RequiredCheck[] {
  const requiredChecks = new Map<string, RequiredCheck>();
  for (const checkRun of checkRuns) {
    if (checkRun.conclusion !== "success" || checkRun.name.includes("${{")) {
      continue;
    }
    requiredChecks.set(`${checkRun.app.id} ${checkRun.name}`, {
      context: checkRun.name,
      integration_id: checkRun.app.id,
    });
  }
  return [...requiredChecks.values()].sort((first, second) =>
    first.context.localeCompare(second.context),
  );
}

export function buildRequiredRules(existingRules: Rule[], requiredChecks: RequiredCheck[]): Rule[] {
  const keptRules = existingRules.filter(
    (rule) => rule.type !== "required_status_checks" && rule.type !== "code_scanning",
  );
  return [
    ...keptRules,
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: false,
        do_not_enforce_on_create: false,
        required_status_checks: requiredChecks,
      },
    },
    {
      type: "code_scanning",
      parameters: {
        code_scanning_tools: [
          { tool: "CodeQL", security_alerts_threshold: "all", alerts_threshold: "all" },
        ],
      },
    },
  ];
}

if (import.meta.main) {
  const pullRequestNumber = process.argv[2];
  if (pullRequestNumber === undefined || !/^\d+$/.test(pullRequestNumber)) {
    console.error("Usage: bun scripts/ci/sync-required-checks.ts <pull request> [--apply]");
    process.exit(2);
  }
  const headCommit = runGitHubApi([
    `repos/${repository}/pulls/${pullRequestNumber}`,
    "--jq",
    ".head.sha",
  ]).trim();
  const checkRuns = runGitHubApi([
    "--paginate",
    `repos/${repository}/commits/${headCommit}/check-runs?per_page=100`,
    "--jq",
    ".check_runs[] | {name, conclusion, app: {id: .app.id}}",
  ])
    .trim()
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as CheckRun);
  const requiredChecks = selectRequiredChecks(checkRuns);
  const rulesets = JSON.parse(runGitHubApi([`repos/${repository}/rulesets`])) as Ruleset[];
  const rulesetSummary = rulesets.find((ruleset) => ruleset.name === rulesetName);
  if (rulesetSummary === undefined) {
    console.error(`No ruleset named ${rulesetName}`);
    process.exit(1);
  }
  const ruleset = JSON.parse(
    runGitHubApi([`repos/${repository}/rulesets/${rulesetSummary.id}`]),
  ) as Ruleset;
  console.log(
    `${rulesetName} will require ${requiredChecks.length} checks from ${headCommit.slice(0, 8)}:\n` +
      requiredChecks.map((requiredCheck) => `  ${requiredCheck.context}`).join("\n"),
  );
  console.log("  and no new CodeQL alert of any severity");
  if (!process.argv.includes("--apply")) {
    console.log("Dry run; pass --apply to write it.");
    process.exit(0);
  }
  runGitHubApi(
    ["--method", "PUT", `repos/${repository}/rulesets/${ruleset.id}`, "--input", "-"],
    JSON.stringify({ rules: buildRequiredRules(ruleset.rules, requiredChecks) }),
  );
  console.log("Applied.");
}
