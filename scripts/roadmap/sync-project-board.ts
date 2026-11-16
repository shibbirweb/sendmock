// Keeps every item on the roadmap project board in line with its issue: Target is the issue's
// release milestone (release-milestones.ts), and Status is Done for a closed issue, the
// feature's status for a feature issue, and otherwise In progress or Later. Also makes the
// Target field's options the release milestones, in release order. Run after sync-issues.ts.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { FeatureIssue } from "./build-feature-issues";
import { generatedIssuesPath } from "./generated-issues-path";
import {
  type BoardItem,
  planBoardItemChanges,
  type ProjectFieldInfo,
  targetOptionColor,
} from "./project-board-plan";
import { releaseMilestones } from "./release-milestones";

const folder = import.meta.dir;
const repository = "shibbirweb/sendmock";
const projectNumber = "6";
const projectOwner = "shibbirweb";
const projectId = "PVT_kwHOAiP0Xc4BqkKV";
const fieldsPath = join(folder, "roadmap-project-fields.jsonl");
const mutationsPerRequest = 20;

function run(command: string, commandArguments: string[]): string {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = spawnSync(command, commandArguments, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status === 0) {
      return result.stdout.trim();
    }
    console.error(`attempt ${attempt}: ${result.stderr.trim()}`);
    Bun.sleepSync(attempt * 20_000);
  }
  throw new Error(`gave up: ${commandArguments.slice(0, 3).join(" ")}`);
}

function readProjectFields(): ProjectFieldInfo[] {
  const fieldList = JSON.parse(
    run("gh", [
      "project",
      "field-list",
      projectNumber,
      "--owner",
      projectOwner,
      "--format",
      "json",
    ]),
  ) as { fields: (ProjectFieldInfo & { type: string })[] };
  return fieldList.fields
    .filter((field) =>
      ["Status", "Area", "Target", "Feature ID", "Criteria met"].includes(
        field.name,
      ),
    )
    .map((field) => ({
      id: field.id,
      name: field.name,
      options:
        field.options?.map((option) => ({
          id: option.id,
          name: option.name,
        })) ?? null,
    }));
}

/** Makes Target's options the release milestones; GitHub clears every Target value when they change. */
function syncTargetOptions(projectFields: ProjectFieldInfo[]) {
  const targetField = projectFields.find((field) => field.name === "Target");
  if (targetField === undefined) {
    throw new Error("The project has no Target field.");
  }
  const currentOptionNames = (targetField.options ?? []).map(
    (option) => option.name,
  );
  if (currentOptionNames.join("\n") === releaseMilestones.join("\n")) {
    return projectFields;
  }
  const optionsInput = releaseMilestones
    .map(
      (milestone) =>
        `{name: ${JSON.stringify(milestone)}, color: ${targetOptionColor(milestone)}, description: ""}`,
    )
    .join(", ");
  run("gh", [
    "api",
    "graphql",
    "-f",
    `query=mutation { updateProjectV2Field(input: {fieldId: "${targetField.id}", singleSelectOptions: [${optionsInput}]}) { clientMutationId } }`,
  ]);
  console.log(`Target options set to: ${releaseMilestones.join(", ")}`);
  return readProjectFields();
}

function readBoardItems(): BoardItem[] {
  const itemList = JSON.parse(
    run("gh", [
      "project",
      "item-list",
      projectNumber,
      "--owner",
      projectOwner,
      "--limit",
      "1000",
      "--format",
      "json",
    ]),
  ) as {
    items: {
      id: string;
      status?: string;
      target?: string;
      content: { number?: number; type: string };
    }[];
  };
  const issueStates = new Map(
    (
      JSON.parse(
        run("gh", [
          "issue",
          "list",
          "-R",
          repository,
          "--state",
          "all",
          "--limit",
          "2000",
          "--json",
          "number,state,milestone",
        ]),
      ) as {
        number: number;
        state: string;
        milestone: { title: string } | null;
      }[]
    ).map((issue) => [issue.number, issue]),
  );
  return itemList.items.flatMap((item) => {
    const issue =
      item.content.type === "Issue" && item.content.number !== undefined
        ? issueStates.get(item.content.number)
        : undefined;
    if (issue === undefined) {
      return [];
    }
    return [
      {
        itemId: item.id,
        issueNumber: issue.number,
        isClosed: issue.state === "CLOSED",
        milestoneTitle: issue.milestone?.title ?? null,
        status: item.status ?? null,
        target: item.target ?? null,
      },
    ];
  });
}

function readFeatureStatuses(): Map<number, FeatureIssue["status"]> {
  if (!existsSync(generatedIssuesPath)) {
    return new Map();
  }
  const issueNumbers = JSON.parse(
    readFileSync(join(folder, "roadmap-issue-numbers.json"), "utf8"),
  ) as Record<string, { number: number }>;
  const featureIssues = JSON.parse(
    readFileSync(generatedIssuesPath, "utf8"),
  ) as FeatureIssue[];
  return new Map(
    featureIssues.flatMap((featureIssue) => {
      const issueNumber = issueNumbers[featureIssue.key]?.number;
      return issueNumber === undefined
        ? []
        : [[issueNumber, featureIssue.status] as const];
    }),
  );
}

const projectFields = syncTargetOptions(readProjectFields());
writeFileSync(
  fieldsPath,
  `${projectFields.map((field) => JSON.stringify(field)).join("\n")}\n`,
);
const fieldChanges = planBoardItemChanges(
  readBoardItems(),
  readFeatureStatuses(),
  projectFields,
);
for (
  let changeIndex = 0;
  changeIndex < fieldChanges.length;
  changeIndex += mutationsPerRequest
) {
  const mutationLines = fieldChanges
    .slice(changeIndex, changeIndex + mutationsPerRequest)
    .map((fieldChange, lineIndex) =>
      fieldChange.optionId === null
        ? `  change${lineIndex}: clearProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${fieldChange.itemId}", fieldId: "${fieldChange.fieldId}"}) { clientMutationId }`
        : `  change${lineIndex}: updateProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${fieldChange.itemId}", fieldId: "${fieldChange.fieldId}", value: {singleSelectOptionId: "${fieldChange.optionId}"}}) { clientMutationId }`,
    );
  run("gh", [
    "api",
    "graphql",
    "-f",
    `query=mutation {\n${mutationLines.join("\n")}\n}`,
  ]);
  Bun.sleepSync(1000);
}
console.log(`board synced: ${fieldChanges.length} field values changed`);
