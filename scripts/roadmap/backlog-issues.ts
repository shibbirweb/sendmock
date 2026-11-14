// The after-1.0 backlog from docs/plan/11-roadmap.md, as issues.
import type { FeatureIssue } from "./build-feature-issues";

const blobBase = "https://github.com/shibbirweb/sendmock/blob/feat/phase-0";
const roadmapLink = `[After 1.0 (backlog)](${blobBase}/docs/plan/11-roadmap.md#after-10-backlog)`;

type BacklogItem = {
  key: string;
  title: string;
  area: string;
  idea: string;
  today: string;
  source?: string;
};

const backlogItems: BacklogItem[] = [
  {
    key: "later-official-repositories",
    title: "Official distribution repositories (Debian, Ubuntu, Fedora, Arch)",
    area: "Distribution",
    idea: "`sudo apt install sendmock` and the like with no setup, from the distributions' own repositories. This needs a sponsor or packager in each distribution, every Rust dependency packaged there, and a history of stable releases.",
    today:
      "SendMock ships through its own channels: install scripts, Homebrew, Scoop, npm, cargo, our signed APT and YUM repository, WinGet, Chocolatey, AUR, COPR and Nixpkgs (feature DS-03).",
    source: `${blobBase}/docs/plan/09-distribution.md#package-channels-by-stage-decided-2026-10-27`,
  },
];

export const backlogIssues: FeatureIssue[] = backlogItems.map(
  (backlogItem) => ({
    key: backlogItem.key,
    title: `${backlogItem.area}: ${backlogItem.title}`,
    body: [
      "### Summary",
      "",
      backlogItem.idea,
      "",
      "### What SendMock does today",
      "",
      backlogItem.today,
      "",
      "### Status",
      "",
      "| | |",
      "|---|---|",
      "| **Status** | Later |",
      `| **Area** | ${backlogItem.area} |`,
      "| **Target** | After 1.0 |",
      "| **Acceptance criteria** | Not written yet |",
      "",
      "Not started. Before work begins, the feature gets an ID and numbered acceptance criteria in `docs/plan/acceptance/`, and this issue is updated with them.",
      "",
      "### References",
      "",
      `- Roadmap: ${roadmapLink}`,
      ...(backlogItem.source ? [`- Design notes: ${backlogItem.source}`] : []),
      "",
    ].join("\n"),
    labels: [
      "feature",
      `area: ${backlogItem.area.toLowerCase()}`,
      "status: later",
    ],
    status: "Later",
    target: "After 1.0",
    area: backlogItem.area,
    isClosed: false,
    criteriaSummary: "Not written yet",
  }),
);
