// Brings the feature issues in line with the acceptance files: body, title, labels, project
// status, Target and Criteria met, release milestone, open or closed. Run build-feature-issues.ts first, and
// publish-new-issues.ts for features that have no issue yet.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FeatureIssue } from "./build-feature-issues";
import { generatedIssuesPath } from "./generated-issues-path";

const folder = import.meta.dir;
const repository = "shibbirweb/sendmock";
const projectId = "PVT_kwHOAiP0Xc4BqkKV";

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

type FieldInfo = {
  id: string;
  name: string;
  options: { id: string; name: string }[] | null;
};
const fields = readFileSync(
  join(folder, "roadmap-project-fields.jsonl"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as FieldInfo);
const findField = (fieldName: string) =>
  fields.find((field) => field.name === fieldName) as FieldInfo;
const findOption = (fieldName: string, optionName: string) =>
  findField(fieldName).options?.find((option) => option.name === optionName)
    ?.id ?? "";

const state = JSON.parse(
  readFileSync(join(folder, "roadmap-issue-numbers.json"), "utf8"),
) as Record<string, { number: number; itemId?: string }>;
const issues = JSON.parse(
  readFileSync(generatedIssuesPath, "utf8"),
) as FeatureIssue[];
// A feature's target is its release milestone (release-milestones.ts). Released milestones
// are closed, and `gh issue edit --milestone` finds only open ones, so the number is used.
const milestoneNumbers = new Map(
  (
    JSON.parse(
      run("gh", [
        "api",
        `repos/${repository}/milestones?state=all&per_page=100`,
      ]),
    ) as { number: number; title: string }[]
  ).map((milestone) => [milestone.title, milestone.number]),
);
const findMilestoneNumber = (milestoneTitle: string) => {
  const milestoneNumber = milestoneNumbers.get(milestoneTitle);
  if (milestoneNumber === undefined) {
    throw new Error(`No milestone named ${milestoneTitle}`);
  }
  return milestoneNumber;
};

let changedCount = 0;
for (const issue of issues) {
  const entry = state[issue.key];
  if (entry === undefined) {
    continue;
  }
  const current = JSON.parse(
    run("gh", [
      "issue",
      "view",
      String(entry.number),
      "-R",
      repository,
      "--json",
      "title,body,labels,state,milestone",
    ]),
  ) as {
    title: string;
    body: string;
    labels: { name: string }[];
    state: string;
    milestone: { title: string } | null;
  };
  const currentLabels = current.labels
    .map((label) => label.name)
    .filter(
      (name) =>
        name === "feature" ||
        name.startsWith("area: ") ||
        name.startsWith("status: "),
    );
  const isBodyChanged =
    current.body.trim() !== issue.body.trim() || current.title !== issue.title;
  const isLabelChanged =
    [...currentLabels].sort().join() !== [...issue.labels].sort().join();
  const wantedState = issue.isClosed ? "CLOSED" : "OPEN";
  const isMilestoneChanged = current.milestone?.title !== issue.target;
  if (
    !isBodyChanged &&
    !isLabelChanged &&
    current.state === wantedState &&
    !isMilestoneChanged
  ) {
    continue;
  }
  changedCount += 1;
  const bodyPath = join(tmpdir(), "sendmock-roadmap-issue-body.md");
  writeFileSync(bodyPath, issue.body);
  const editArguments = [
    "issue",
    "edit",
    String(entry.number),
    "-R",
    repository,
    "--title",
    issue.title,
    "--body-file",
    bodyPath,
  ];
  for (const label of currentLabels.filter(
    (name) => !issue.labels.includes(name),
  )) {
    editArguments.push("--remove-label", label);
  }
  for (const label of issue.labels.filter(
    (name) => !currentLabels.includes(name),
  )) {
    editArguments.push("--add-label", label);
  }
  run("gh", editArguments);
  if (isMilestoneChanged) {
    run("gh", [
      "api",
      "-X",
      "PATCH",
      `repos/${repository}/issues/${entry.number}`,
      "-F",
      `milestone=${findMilestoneNumber(issue.target)}`,
    ]);
  }
  const mutation = `mutation {
  status: updateProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${entry.itemId}", fieldId: "${findField("Status").id}", value: {singleSelectOptionId: "${findOption("Status", issue.status)}"}}) { clientMutationId }
  target: updateProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${entry.itemId}", fieldId: "${findField("Target").id}", value: {singleSelectOptionId: "${findOption("Target", issue.target)}"}}) { clientMutationId }
  criteria: updateProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${entry.itemId}", fieldId: "${findField("Criteria met").id}", value: {text: ${JSON.stringify(issue.criteriaSummary)}}}) { clientMutationId }
}`;
  run("gh", ["api", "graphql", "-f", `query=${mutation}`]);
  if (current.state !== wantedState) {
    run("gh", [
      "issue",
      wantedState === "CLOSED" ? "close" : "reopen",
      String(entry.number),
      "-R",
      repository,
      ...(wantedState === "CLOSED" ? ["--reason", "completed"] : []),
    ]);
  }
  console.log(`updated #${entry.number} ${issue.title}`);
  Bun.sleepSync(1500);
}
console.log(`synced: ${changedCount} issues changed`);
