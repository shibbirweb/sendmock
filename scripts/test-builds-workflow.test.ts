import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
};
type WorkflowJob = {
  needs?: string | string[];
  if?: string;
  uses?: string;
  with?: Record<string, string>;
  permissions?: Record<string, string>;
  strategy?: { matrix?: { include?: Record<string, string>[] } };
  steps?: WorkflowStep[];
};
type WorkflowTriggers = Record<
  string,
  { branches?: string[]; paths?: string[] } | null
>;
type Workflow = {
  on?: WorkflowTriggers;
  true?: WorkflowTriggers;
  concurrency?: { group: string; "cancel-in-progress": string };
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
};

function readWorkflow(fileName: string): Workflow {
  return Bun.YAML.parse(
    readFileSync(`.github/workflows/${fileName}`, "utf8"),
  ) as Workflow;
}

const workflow = readWorkflow("test-builds.yml");
// A YAML 1.1 reader takes the key `on` for the boolean true.
const triggers = workflow.on ?? workflow.true ?? {};
const testJob = workflow.jobs.test ?? {};
const reportJob = workflow.jobs.report ?? {};
const releaseTargets = [
  "aarch64-apple-darwin",
  "aarch64-pc-windows-msvc",
  "aarch64-unknown-linux-musl",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "x86_64-unknown-linux-musl",
];

function findStep(
  job: WorkflowJob,
  isWanted: (step: WorkflowStep) => boolean,
): WorkflowStep | undefined {
  return (job.steps ?? []).find(isWanted);
}

describe("Test builds workflow", () => {
  test("DS-11.1 runs on every pull request, into any branch, and every push to develop and main", () => {
    expect(Object.keys(triggers).sort()).toEqual(["pull_request", "push"]);
    expect(triggers.pull_request).toBeNull();
    expect(triggers.push?.branches).toEqual(["develop", "main"]);
  });

  test("DS-11.1 a newer push to a pull request cancels the older run, and develop and main keep each one", () => {
    expect(workflow.concurrency?.group).toBe("test-builds-${{ github.ref }}");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(
      "${{ github.event_name == 'pull_request' }}",
    );
  });

  test("DS-11.1 builds the six targets with the release build's own workflow, from the pull request's head commit, publishing nothing", () => {
    const buildArchivesTargets = (
      readWorkflow("build-archives.yml").jobs.build?.strategy?.matrix
        ?.include ?? []
    ).map((entry) => entry.target);
    const workflowText = readFileSync(
      ".github/workflows/test-builds.yml",
      "utf8",
    );

    expect(workflow.jobs.build?.uses).toBe(
      "./.github/workflows/build-archives.yml",
    );
    expect(readWorkflow("release.yml").jobs.build?.uses).toBe(
      "./.github/workflows/build-archives.yml",
    );
    expect(workflow.jobs.build?.with?.commit_sha).toBe(
      "${{ github.event.pull_request.head.sha || github.sha }}",
    );
    expect(buildArchivesTargets.sort()).toEqual(releaseTargets);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflowText).not.toContain("release.yml");
    expect(workflowText).not.toMatch(
      /gh release|docker push|npm publish|cargo publish/,
    );
  });

  test("DS-11.2 tests each archive on its own platform before attaching it as sendmock-<target triple>", () => {
    const testedTargets = (testJob.strategy?.matrix?.include ?? []).map(
      (entry) => entry.target,
    );
    const steps = testJob.steps ?? [];
    const checkIndex = steps.findIndex(
      (step) => step.run?.includes("scripts/release/check-archive.ts") ?? false,
    );
    const uploadIndex = steps.findIndex(
      (step) => step.uses?.startsWith("actions/upload-artifact") ?? false,
    );

    expect(testedTargets.sort()).toEqual(releaseTargets);
    expect(testJob.needs).toEqual(["version", "build"]);
    expect(checkIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(checkIndex);
    expect(steps[uploadIndex]?.with?.name).toBe(
      "sendmock-${{ matrix.target }}",
    );
    expect(steps[uploadIndex]?.with?.path).toBe("dist");
  });

  test("DS-11.2 keeps the test builds 14 days for a pull request and 30 days for develop and main", () => {
    const uploadStep = findStep(
      testJob,
      (step) => step.uses?.startsWith("actions/upload-artifact") ?? false,
    );

    expect(uploadStep?.with?.["retention-days"]).toBe(
      "${{ github.event_name == 'pull_request' && 14 || 30 }}",
    );
  });

  test("DS-11.3 checks that each test build reports the version in the code and the dev channel", () => {
    const checkStep = findStep(
      testJob,
      (step) => step.run?.includes("scripts/release/check-archive.ts") ?? false,
    );

    expect(workflow.jobs.build?.with?.channel).toBe("dev");
    expect(checkStep?.run).toEndWith(
      "${{ needs.version.outputs.version }} dev",
    );
  });

  test("DS-11.4 lists the builds even when one platform failed, and comments only on a pull request from this repository", () => {
    const reportStep = findStep(
      reportJob,
      (step) => step.run?.includes("scripts/test-builds-report.ts") ?? false,
    );
    const downloadStep = findStep(
      reportJob,
      (step) => step.uses?.startsWith("actions/download-artifact") ?? false,
    );

    expect(reportJob.if).toBe("${{ !cancelled() }}");
    expect(downloadStep?.with?.pattern).toBe("sendmock-*");
    expect(reportJob.permissions?.["pull-requests"]).toBe("write");
    expect(reportStep?.env?.PULL_REQUEST_NUMBER).toBe(
      "${{ github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.number || '' }}",
    );
  });

  test("DS-11.5 the install page says how to download, check and run a test build", () => {
    const installPage = readFileSync("docs/wiki/install.md", "utf8");
    const testBuildSection = installPage.slice(
      installPage.indexOf("## Try a build that is not released yet"),
      installPage.indexOf("## Menu bar and tray app"),
    );

    expect(testBuildSection).toContain("Test builds of");
    expect(testBuildSection).toContain("gh run download");
    expect(testBuildSection).toContain("shasum -a 256");
    expect(testBuildSection).toContain("Get-FileHash");
    expect(testBuildSection).toContain("GitHub account");
    expect(testBuildSection).toContain("xattr -d com.apple.quarantine");
    expect(testBuildSection).toContain("sendmock --version");
  });
});
