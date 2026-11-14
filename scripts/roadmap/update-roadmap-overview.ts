// Writes the pinned "Roadmap to SendMock 1.0" issue again from the current feature issues
// (the counts and the by-area lists). Run after sync-issues.ts.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FeatureIssue } from "./build-feature-issues";
import { generatedIssuesPath } from "./generated-issues-path";

const folder = import.meta.dir;
const repository = "shibbirweb/sendmock";
const repositoryUrl = `https://github.com/${repository}`;
const projectUrl = "https://github.com/users/shibbirweb/projects/6";

function run(command: string, commandArguments: string[]): string {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = spawnSync(command, commandArguments, { encoding: "utf8" });
    if (result.status === 0) {
      return result.stdout.trim();
    }
    console.error(`attempt ${attempt}: ${result.stderr.trim()}`);
    Bun.sleepSync(attempt * 20_000);
  }
  throw new Error(`gave up: ${commandArguments.slice(0, 3).join(" ")}`);
}

type StateEntry = { number: number };
const statePath = join(folder, "roadmap-issue-numbers.json");
const state = JSON.parse(readFileSync(statePath, "utf8")) as Record<
  string,
  StateEntry
>;
const issues = JSON.parse(
  readFileSync(generatedIssuesPath, "utf8"),
) as FeatureIssue[];

const searchLink = (label: string, query: string) =>
  `[${label}](${repositoryUrl}/issues?q=${encodeURIComponent(query)})`;
const areaOrder = [
  "Email",
  "SMS",
  "Verify",
  "Webhooks",
  "HTTP catcher",
  "Platform",
  "Payments",
  "AI",
  "Web UI",
  "Distribution",
  "Website",
];
const featureIssues = issues.filter((issue) => issue.target === "1.0");
const backlogIssues = issues.filter((issue) => issue.target === "After 1.0");
const countWith = (status: string) =>
  featureIssues.filter((issue) => issue.status === status).length;
const taskLine = (issue: FeatureIssue) =>
  `- [${issue.status === "Done" ? "x" : " "}] #${state[issue.key]?.number}`;

const overviewBody = [
  "### Summary",
  "",
  "SendMock's way to 1.0 and what comes after, with one issue per feature. Each feature issue explains what the feature does, lists its acceptance criteria as a checklist (a checked item is proven by a test that passes in CI) and links the tests.",
  "",
  "### Where things stand",
  "",
  "| | |",
  "|---|---|",
  `| **Done** | ${countWith("Done")} of ${featureIssues.length} features for 1.0, built in pull request 48 and released with the first beta |`,
  `| **In progress** | ${countWith("In progress")} features, each waiting for something named in its issue |`,
  `| **Later** | ${countWith("Later")} feature for 1.0 not started yet, and ${backlogIssues.length} ideas for after 1.0 |`,
  "",
  "### Follow along",
  "",
  `- Project board: [SendMock roadmap](${projectUrl}) (views: All features, Board, In progress, Later, Done, Target 1.0, After 1.0)`,
  `- Milestones: [all milestones](${repositoryUrl}/milestones)`,
  `- Issue searches: ${searchLink("all features", "is:issue label:feature")}, ${searchLink("done", 'is:issue label:feature label:"status: done"')}, ${searchLink("in progress", 'is:issue is:open label:"status: in progress"')}, ${searchLink("later", 'is:issue is:open label:"status: later"')}`,
  "",
  "### Features for 1.0, by area",
  "",
  ...areaOrder.flatMap((area) => {
    const areaIssues = featureIssues.filter((issue) => issue.area === area);
    if (areaIssues.length === 0) {
      return [];
    }
    const doneCount = areaIssues.filter(
      (issue) => issue.status === "Done",
    ).length;
    return [
      `#### ${area} (${doneCount} of ${areaIssues.length} done)`,
      "",
      ...areaIssues.map(taskLine),
      "",
    ];
  }),
  "### After 1.0",
  "",
  ...backlogIssues.map(taskLine),
  "",
  "### How this is kept current",
  "",
  `The plan in [\`docs/plan/PROGRESS.md\`](${repositoryUrl}/blob/feat/phase-0/docs/plan/PROGRESS.md) and the acceptance criteria in [\`docs/plan/acceptance/\`](${repositoryUrl}/tree/feat/phase-0/docs/plan/acceptance) are the source of truth. When a pull request ticks criteria, the matching feature issues are updated, and closed once the feature is accepted.`,
  "",
].join("\n");

const overviewNumber = state.overview?.number;
if (overviewNumber === undefined) {
  throw new Error("No overview issue number in roadmap-issue-numbers.json.");
}
const bodyPath = join(tmpdir(), "sendmock-roadmap-overview.md");
writeFileSync(bodyPath, overviewBody);
run("gh", [
  "issue",
  "edit",
  String(overviewNumber),
  "-R",
  repository,
  "--body-file",
  bodyPath,
]);
console.log(`overview #${overviewNumber} updated`);
