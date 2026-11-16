// Writes the pinned roadmap issue again from the current feature issues (the counts, the
// 1.0 features by area and each later release). Run after sync-issues.ts.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FeatureIssue } from "./build-feature-issues";
import { generatedIssuesPath } from "./generated-issues-path";
import {
  firstBetaMilestone,
  releasedMilestones,
  releaseMilestones,
  waitingOnOthersMilestone,
} from "./release-milestones";

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
// The features that made 1.0, released with the first beta or in 1.0.0, listed by area.
const oneZeroMilestones = new Set([firstBetaMilestone, "1.0.0"]);
const oneZeroIssues = issues.filter((issue) =>
  oneZeroMilestones.has(issue.target),
);
const laterMilestones = releaseMilestones.filter(
  (milestone) => !oneZeroMilestones.has(milestone),
);
const countWith = (status: string) =>
  issues.filter((issue) => issue.status === status).length;
const taskLine = (issue: FeatureIssue) =>
  `- [${issue.status === "Done" ? "x" : " "}] #${state[issue.key]?.number}`;
const describeMilestone = (milestone: string) => {
  if (milestone === waitingOnOthersMilestone) {
    return "Work that waits for an outside party; it gets a release once they act.";
  }
  return releasedMilestones.has(milestone) ? "Released." : "Planned.";
};

const overviewBody = [
  "### Summary",
  "",
  "SendMock's releases, one milestone each, with one issue per feature. Each feature issue explains what the feature does, lists its acceptance criteria as a checklist (a checked item is proven by a test that passes in CI) and links the tests.",
  "",
  "### Where things stand",
  "",
  "| | |",
  "|---|---|",
  `| **Done** | ${countWith("Done")} of ${issues.length} features |`,
  `| **In progress** | ${countWith("In progress")} features, each waiting for something named in its issue |`,
  `| **Later** | ${countWith("Later")} features planned for a release and not started yet |`,
  "",
  "### Follow along",
  "",
  `- Project board: [SendMock roadmap](${projectUrl}); each item's Target is its release milestone`,
  `- Milestones: [all milestones](${repositoryUrl}/milestones?state=all)`,
  `- Issue searches: ${searchLink("all features", "is:issue label:feature")}, ${searchLink("done", 'is:issue label:feature label:"status: done"')}, ${searchLink("in progress", 'is:issue is:open label:"status: in progress"')}, ${searchLink("later", 'is:issue is:open label:"status: later"')}`,
  "",
  "### 1.0: the first beta and 1.0.0, by area",
  "",
  ...areaOrder.flatMap((area) => {
    const areaIssues = oneZeroIssues.filter((issue) => issue.area === area);
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
  ...laterMilestones.flatMap((milestone) => {
    const milestoneIssues = issues.filter((issue) => issue.target === milestone);
    return [
      `### ${milestone}`,
      "",
      `${describeMilestone(milestone)} Everything in it, features and bug fixes: ${searchLink(`milestone ${milestone}`, `is:issue milestone:"${milestone}"`)}.`,
      "",
      ...(milestoneIssues.length === 0
        ? ["No feature issues; bug fixes only."]
        : milestoneIssues.map(taskLine)),
      "",
    ];
  }),
  "### How this is kept current",
  "",
  `The plan in [\`docs/plan/PROGRESS.md\`](${repositoryUrl}/blob/develop/docs/plan/PROGRESS.md) and the acceptance criteria in [\`docs/plan/acceptance/\`](${repositoryUrl}/tree/develop/docs/plan/acceptance) are the source of truth. Each feature's intro names its release. When a pull request ticks criteria, the matching feature issues, their milestones and the project board are updated, and an issue is closed once its feature is accepted.`,
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
  "--title",
  "SendMock roadmap",
  "--body-file",
  bodyPath,
]);
console.log(`overview #${overviewNumber} updated`);
