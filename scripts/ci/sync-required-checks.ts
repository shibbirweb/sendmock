// Makes every CI check required on develop and main: the Core Protection ruleset requires each
// workflow's "passed" gate (from the workflow files) and blocks any pull request that adds a
// CodeQL alert. Prints the change; `--apply` writes it (needs a repository admin's gh login).
import { spawnSync } from "node:child_process";

import { listRequiredChecks } from "./workflow-gates";

const repository = "shibbirweb/sendmock";
const rulesetName = "Core Protection";
/** GitHub Actions, the app every gate reports as. */
const githubActionsAppId = 15368;

type Rule = { type: string; parameters?: Record<string, unknown> };
type Ruleset = { id: number; name: string; rules: Rule[] };

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

export function buildRequiredRules(existingRules: Rule[], requiredChecks: string[]): Rule[] {
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
        required_status_checks: requiredChecks.map((checkName) => ({
          context: checkName,
          integration_id: githubActionsAppId,
        })),
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
  const rulesets = JSON.parse(runGitHubApi([`repos/${repository}/rulesets`])) as Ruleset[];
  const rulesetSummary = rulesets.find((ruleset) => ruleset.name === rulesetName);
  if (rulesetSummary === undefined) {
    console.error(`No ruleset named ${rulesetName}`);
    process.exit(1);
  }
  const ruleset = JSON.parse(
    runGitHubApi([`repos/${repository}/rulesets/${rulesetSummary.id}`]),
  ) as Ruleset;
  const requiredChecks = listRequiredChecks();
  console.log(`${rulesetName} will require:\n${requiredChecks.map((checkName) => `  ${checkName}`).join("\n")}`);
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
