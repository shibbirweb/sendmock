// Creates the issues that have no number yet (a new feature), adds each to the roadmap project
// with its fields and closes done ones. Created issues are recorded in
// roadmap-issue-numbers.json, so it is safe to run again.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FeatureIssue } from "./build-feature-issues";
import { generatedIssuesPath } from "./generated-issues-path";

const folder = import.meta.dir;
const repository = "shibbirweb/sendmock";
const projectNumber = "6";
const projectOwner = "shibbirweb";
const projectId = "PVT_kwHOAiP0Xc4BqkKV";
const pauseMs = 2500;

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
const findField = (fieldName: string) => {
  const field = fields.find((candidate) => candidate.name === fieldName);
  if (!field) {
    throw new Error(`No field ${fieldName}`);
  }
  return field;
};
const findOption = (fieldName: string, optionName: string) => {
  const option = findField(fieldName).options?.find(
    (candidate) => candidate.name === optionName,
  );
  if (!option) {
    throw new Error(`No option ${optionName} in ${fieldName}`);
  }
  return option.id;
};

function run(command: string, commandArguments: string[]): string {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = spawnSync(command, commandArguments, { encoding: "utf8" });
    if (result.status === 0) {
      return result.stdout.trim();
    }
    console.error(
      `attempt ${attempt} failed: ${command} ${commandArguments.slice(0, 3).join(" ")}: ${result.stderr.trim()}`,
    );
    Bun.sleepSync(attempt * 20_000);
  }
  throw new Error(
    `gave up: ${command} ${commandArguments.slice(0, 3).join(" ")}`,
  );
}

const statePath = join(folder, "roadmap-issue-numbers.json");
const state: Record<
  string,
  { number: number; itemId?: string; isFieldsSet?: boolean; isClosed?: boolean }
> = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const saveState = () =>
  writeFileSync(statePath, JSON.stringify(state, null, 2));

const issues = JSON.parse(
  readFileSync(generatedIssuesPath, "utf8"),
) as FeatureIssue[];
for (const issue of issues) {
  let entry = state[issue.key];
  if (entry === undefined) {
    const bodyPath = join(tmpdir(), "sendmock-roadmap-issue-body.md");
    writeFileSync(bodyPath, issue.body);
    const issueUrl = run("gh", [
      "issue",
      "create",
      "-R",
      repository,
      "--title",
      issue.title,
      "--body-file",
      bodyPath,
      "--label",
      issue.labels.join(","),
    ]);
    entry = { number: Number(issueUrl.split("/").pop()) };
    state[issue.key] = entry;
    saveState();
    console.log(`created #${entry.number} ${issue.title}`);
    Bun.sleepSync(pauseMs);
  }
  if (entry.itemId === undefined) {
    entry.itemId = run("gh", [
      "project",
      "item-add",
      projectNumber,
      "--owner",
      projectOwner,
      "--url",
      `https://github.com/${repository}/issues/${entry.number}`,
      "--format",
      "json",
      "--jq",
      ".id",
    ]);
    saveState();
  }
  if (!entry.isFieldsSet) {
    const featureId = issue.key.startsWith("later-") ? "" : issue.key;
    const updates = [
      [
        "status",
        findField("Status").id,
        `{singleSelectOptionId: "${findOption("Status", issue.status)}"}`,
      ],
      [
        "area",
        findField("Area").id,
        `{singleSelectOptionId: "${findOption("Area", issue.area)}"}`,
      ],
      [
        "target",
        findField("Target").id,
        `{singleSelectOptionId: "${findOption("Target", issue.target)}"}`,
      ],
      [
        "criteria",
        findField("Criteria met").id,
        `{text: ${JSON.stringify(issue.criteriaSummary)}}`,
      ],
      ...(featureId === ""
        ? []
        : [
            [
              "featureId",
              findField("Feature ID").id,
              `{text: ${JSON.stringify(featureId)}}`,
            ],
          ]),
    ];
    const mutation = `mutation {\n${updates
      .map(
        ([alias, fieldId, value]) =>
          `  ${alias}: updateProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${entry.itemId}", fieldId: "${fieldId}", value: ${value}}) { clientMutationId }`,
      )
      .join("\n")}\n}`;
    run("gh", ["api", "graphql", "-f", `query=${mutation}`]);
    entry.isFieldsSet = true;
    saveState();
    Bun.sleepSync(pauseMs);
  }
  if (issue.isClosed && !entry.isClosed) {
    run("gh", [
      "issue",
      "close",
      String(entry.number),
      "-R",
      repository,
      "--reason",
      "completed",
    ]);
    entry.isClosed = true;
    saveState();
    Bun.sleepSync(pauseMs);
  }
}
console.log(`done: ${Object.keys(state).length} issues`);
