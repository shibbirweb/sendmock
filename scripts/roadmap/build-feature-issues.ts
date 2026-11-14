// Builds one GitHub issue per acceptance feature, plus the after-1.0 backlog, from
// docs/plan/acceptance/, into a temporary file the other roadmap scripts read.
// Run from the repository root: bun scripts/roadmap/build-feature-issues.ts
import { writeFileSync } from "node:fs";

import {
  acceptanceFolder,
  blobBase,
  branch,
  type Feature,
  listProvingFiles,
  parseFeatures,
  readStatuses,
  toAbsoluteLinks,
} from "./acceptance-features";
import { featureSummaries } from "./feature-summaries";
import { generatedIssuesPath } from "./generated-issues-path";

export type FeatureIssue = {
  key: string;
  title: string;
  body: string;
  labels: string[];
  status: "Done" | "In progress" | "Later";
  target: "1.0" | "After 1.0";
  area: string;
  isClosed: boolean;
  criteriaSummary: string;
};

const areaByPrefix: Record<string, string> = {
  EM: "Email",
  SM: "SMS",
  VF: "Verify",
  WH: "Webhooks",
  HC: "HTTP catcher",
  PL: "Platform",
  AI: "AI",
  UI: "Web UI",
  DS: "Distribution",
  WS: "Website",
  PY: "Payments",
  PN: "Push",
};

const notAcceptedReasons: Record<string, string> = {
  "UI-07":
    "UI-07.3 (the design review) waits for the owner to sign off the review rows of the Subscriptions and API reference screens, the two screens added after the Stage A design sign-off.",
};

function describeIntro(introLines: string[]): {
  phase: string;
  designLinks: string[];
} {
  const introText = introLines.join(" ");
  const phase =
    introText.split(/\. (?:Docs|Plan):/)[0]?.replace(/\.$/, "") ?? "";
  const designLinks = [...introText.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(
    (linkMatch) => `[${linkMatch[1]}](${linkMatch[2]})`,
  );
  return { phase, designLinks };
}

function buildFeatureIssue(
  feature: Feature,
  acceptanceStatus: string,
): FeatureIssue {
  const prefix = feature.id.slice(0, 2);
  const area = areaByPrefix[prefix] ?? "Other";
  const tickedCount = feature.criteria.filter(
    (criterion) => criterion.isTicked,
  ).length;
  const criteriaCount = feature.criteria.length;
  const isDone = acceptanceStatus === "Accepted";
  const isStarted = tickedCount > 0 || acceptanceStatus === "In progress";
  const status: FeatureIssue["status"] = isDone
    ? "Done"
    : isStarted
      ? "In progress"
      : "Later";
  const statusDetail = isDone
    ? `Every criterion is met and proven by automated tests that pass in CI. Built in pull request 48 (\`${branch}\`); it ships in the first release after that pull request is merged.`
    : status === "In progress" && tickedCount === criteriaCount
      ? `Every criterion was met at the Stage A sign-off, but the feature is not accepted yet: ${notAcceptedReasons[feature.id] ?? "it waits for a final check."}`
      : status === "In progress"
        ? "Some criteria are met and proven by tests in CI; each open one is unchecked below with what it waits for."
        : "Planned for 1.0 and not started yet.";
  const summary = featureSummaries[feature.id];
  if (summary === undefined) {
    throw new Error(`No summary for ${feature.id}`);
  }
  const intro = describeIntro(
    feature.introLines.map((introLine) =>
      toAbsoluteLinks(introLine, acceptanceFolder),
    ),
  );
  const criteriaLines = feature.criteria.flatMap((criterion) => [
    `- [${criterion.isTicked ? "x" : " "}] **${criterion.id}** ${toAbsoluteLinks(criterion.text, acceptanceFolder)}`,
    ...criterion.notes.map(
      (note) => `  - ${toAbsoluteLinks(note, acceptanceFolder)}`,
    ),
  ]);
  const provingFiles = listProvingFiles(feature.id);
  const provingSection =
    provingFiles.length === 0
      ? ["No test names this feature's criteria yet."]
      : [
          "<details>",
          `<summary>${provingFiles.length} test and workflow files name this feature's criteria</summary>`,
          "",
          ...provingFiles.map(
            (filePath) => `- [\`${filePath}\`](${blobBase}/${filePath})`,
          ),
          "",
          "</details>",
        ];
  const body = [
    "### Summary",
    "",
    summary.summary,
    "",
    "### Intended outcome",
    "",
    summary.outcome,
    "",
    "### How it works",
    "",
    "The acceptance criteria below describe the behaviour and define when the feature is done. A checked item is proven by an automated test that passes in CI.",
    "",
    ...criteriaLines,
    "",
    "### Status",
    "",
    "| | |",
    "|---|---|",
    `| **Status** | ${status} |`,
    `| **Criteria met** | ${tickedCount} of ${criteriaCount} |`,
    `| **Feature ID** | \`${feature.id}\` |`,
    `| **Area** | ${area} |`,
    "| **Target** | 1.0 |",
    `| **Planned in** | ${intro.phase} |`,
    "",
    statusDetail,
    "",
    "### Tests",
    "",
    ...provingSection,
    "",
    "### References",
    "",
    `- Acceptance criteria: [\`${feature.fileName}\`](${blobBase}/${acceptanceFolder}/${feature.fileName}#${feature.anchor})`,
    ...intro.designLinks.map((designLink) => `- Design: ${designLink}`),
    `- Progress tracker: [\`PROGRESS.md\`](${blobBase}/docs/plan/PROGRESS.md)`,
    "",
  ].join("\n");
  return {
    key: feature.id,
    title: `${area}: ${feature.title}`,
    body,
    labels: [
      "feature",
      `area: ${area.toLowerCase()}`,
      `status: ${status.toLowerCase()}`,
    ],
    status,
    // Features planned after 1.0 say so first in their intro (acceptance/01-email.md EM-19).
    target: intro.phase.startsWith("After 1.0") ? "After 1.0" : "1.0",
    area,
    isClosed: isDone,
    criteriaSummary: `${tickedCount} of ${criteriaCount}`,
  };
}

const acceptanceFiles = [
  "01-email.md",
  "02-sms-verify.md",
  "03-webhooks.md",
  "04-catcher-platform.md",
  "05-ai.md",
  "06-ui.md",
  "07-distribution-website.md",
  "08-payments.md",
  "09-push.md",
];
const statuses = readStatuses();
const featureIssues = acceptanceFiles
  .flatMap(parseFeatures)
  .map((feature) =>
    buildFeatureIssue(feature, statuses.get(feature.id) ?? "Not started"),
  );

const { backlogIssues } = await import("./backlog-issues.ts");
writeFileSync(
  generatedIssuesPath,
  JSON.stringify([...featureIssues, ...backlogIssues], null, 2),
);
console.log(
  `features: ${featureIssues.length}, backlog: ${backlogIssues.length}`,
);
for (const status of ["Done", "In progress", "Later"]) {
  console.log(
    status,
    [...featureIssues, ...backlogIssues].filter(
      (issue) => issue.status === status,
    ).length,
  );
}
