#!/usr/bin/env bun
/**
 * Lists the archives a Test builds run attached (docs/plan/09-distribution.md, Test builds of
 * every pull request): writes the run summary and, on a pull request from this repository,
 * adds or updates the one comment that links them.
 *
 *     bun scripts/test-builds-report.ts <folder of the downloaded sendmock-* artifacts>
 *
 * Reads GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_STEP_SUMMARY, COMMIT_SHA,
 * VERSION, RETENTION_DAYS and PULL_REQUEST_NUMBER (empty for a push or a fork); `gh` reads
 * GH_TOKEN.
 */

import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

/** Finds the comment to update, so a pull request never gets a second one. */
export const commentMarker = "<!-- sendmock-test-builds -->";

export const testBuildTargets = [
  {
    targetTriple: "aarch64-apple-darwin",
    platformName: "macOS, Apple silicon",
  },
  { targetTriple: "x86_64-apple-darwin", platformName: "macOS, Intel" },
  { targetTriple: "x86_64-pc-windows-msvc", platformName: "Windows, x64" },
  { targetTriple: "aarch64-pc-windows-msvc", platformName: "Windows, Arm64" },
  {
    targetTriple: "x86_64-unknown-linux-musl",
    platformName: "Linux, x64 (static)",
  },
  {
    targetTriple: "aarch64-unknown-linux-musl",
    platformName: "Linux, Arm64 (static)",
  },
] as const;

const tryBuildGuideUrl =
  "https://github.com/shibbirweb/sendmock/blob/develop/docs/wiki/install.md#try-a-build-that-is-not-released-yet";

export type TestBuild = {
  targetTriple: string;
  archiveName: string;
  sizeBytes: number;
  sha256: string;
  downloadUrl: string;
};

export type TestBuildsReport = {
  builds: TestBuild[];
  commitSha: string;
  version: string;
  runUrl: string;
  retentionDays: number;
};

/** `<sha256>  <archive name>`, as scripts/release/package-archive.ts writes it. */
export function readChecksumLine(checksumText: string): {
  sha256: string;
  archiveName: string;
} {
  const [sha256 = "", archiveName = ""] = checksumText.trim().split(/\s+/);
  return { sha256, archiveName };
}

export function formatSize(sizeBytes: number): string {
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

/** The summary and the comment: one row per platform, and the ones whose tests did not pass. */
export function renderTestBuildsReport(report: TestBuildsReport): string {
  const shortSha = report.commitSha.slice(0, 7);
  const tableRows = testBuildTargets.flatMap(
    ({ targetTriple, platformName }) => {
      const build = report.builds.find(
        (candidate) => candidate.targetTriple === targetTriple,
      );
      if (build === undefined) {
        return [];
      }
      return [
        `| ${platformName} | [${build.archiveName}](${build.downloadUrl}) | ${formatSize(build.sizeBytes)} | \`${build.sha256}\` |`,
      ];
    },
  );
  const missingPlatforms = testBuildTargets
    .filter(
      ({ targetTriple }) =>
        !report.builds.some((build) => build.targetTriple === targetTriple),
    )
    .map(
      ({ platformName, targetTriple }) =>
        `${platformName} (\`${targetTriple}\`)`,
    );
  const lines = [
    commentMarker,
    `### Test builds of ${shortSha}`,
    "",
    `SendMock ${report.version} on the \`dev\` channel, built from ${report.commitSha} and tested on each platform in [this run](${report.runUrl}). Downloads need a GitHub login and are kept ${report.retentionDays} days. Each download is a zip holding the archive and its \`.sha256\` file; [Try a build that is not released yet](${tryBuildGuideUrl}) says how to check and run it.`,
    "",
  ];
  if (tableRows.length > 0) {
    lines.push(
      "| Platform | Download | Size | SHA-256 |",
      "|---|---|---|---|",
      ...tableRows,
      "",
    );
  }
  if (missingPlatforms.length > 0) {
    lines.push(
      `Not attached, since its build or tests did not pass: ${missingPlatforms.join(", ")}.`,
      "",
    );
  }
  return lines.join("\n");
}

function runGitHubCli(cliArguments: string[]): string {
  const cliResult = Bun.spawnSync(["gh", ...cliArguments]);
  if (cliResult.exitCode !== 0) {
    throw new Error(
      `gh ${cliArguments.join(" ")}: ${cliResult.stderr.toString()}`,
    );
  }
  return cliResult.stdout.toString().trim();
}

/** Each tested archive in the downloaded artifacts, linked to its artifact on the run. */
function collectTestBuilds(
  artifactsFolder: string,
  repository: string,
  runId: string,
  serverUrl: string,
): TestBuild[] {
  const artifactIds = new Map<string, string>(
    runGitHubCli([
      "api",
      "--paginate",
      `repos/${repository}/actions/runs/${runId}/artifacts`,
      "--jq",
      '.artifacts[] | "\\(.name) \\(.id)"',
    ])
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.split(" ") as [string, string]),
  );
  if (!existsSync(artifactsFolder)) {
    return [];
  }
  return testBuildTargets.flatMap(({ targetTriple }) => {
    const artifactName = `sendmock-${targetTriple}`;
    const artifactFolder = join(artifactsFolder, artifactName);
    const artifactId = artifactIds.get(artifactName);
    const checksumFile = existsSync(artifactFolder)
      ? readdirSync(artifactFolder).find((fileName) =>
          fileName.endsWith(".sha256"),
        )
      : undefined;
    if (artifactId === undefined || checksumFile === undefined) {
      return [];
    }
    const { sha256, archiveName } = readChecksumLine(
      readFileSync(join(artifactFolder, checksumFile), "utf8"),
    );
    return [
      {
        targetTriple,
        archiveName,
        sizeBytes: statSync(join(artifactFolder, archiveName)).size,
        sha256,
        downloadUrl: `${serverUrl}/${repository}/actions/runs/${runId}/artifacts/${artifactId}`,
      },
    ];
  });
}

/** Updates the pull request's test builds comment, or adds it the first time. */
function upsertPullRequestComment(
  repository: string,
  pullRequestNumber: string,
  commentBody: string,
) {
  const existingCommentId = runGitHubCli([
    "api",
    "--paginate",
    `repos/${repository}/issues/${pullRequestNumber}/comments`,
    "--jq",
    `.[] | select(.body | contains("${commentMarker}")) | .id`,
  ]).split("\n")[0];
  if (existingCommentId !== undefined && existingCommentId !== "") {
    runGitHubCli([
      "api",
      "--method",
      "PATCH",
      `repos/${repository}/issues/comments/${existingCommentId}`,
      "-f",
      `body=${commentBody}`,
    ]);
    return;
  }
  runGitHubCli([
    "api",
    "--method",
    "POST",
    `repos/${repository}/issues/${pullRequestNumber}/comments`,
    "-f",
    `body=${commentBody}`,
  ]);
}

if (import.meta.main) {
  const artifactsFolder = process.argv[2] ?? "test-builds";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const runId = process.env.GITHUB_RUN_ID ?? "";
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const report = renderTestBuildsReport({
    builds: collectTestBuilds(artifactsFolder, repository, runId, serverUrl),
    commitSha: process.env.COMMIT_SHA ?? "",
    version: process.env.VERSION ?? "",
    runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    retentionDays: Number(process.env.RETENTION_DAYS ?? "14"),
  });
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath !== undefined && summaryPath !== "") {
    appendFileSync(summaryPath, `${report}\n`);
  }
  console.log(report);
  const pullRequestNumber = process.env.PULL_REQUEST_NUMBER ?? "";
  if (pullRequestNumber !== "") {
    upsertPullRequestComment(repository, pullRequestNumber, report);
  }
}
