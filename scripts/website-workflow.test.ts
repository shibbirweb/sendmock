import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type WorkflowStep = {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
};
type WorkflowJob = {
  if?: string;
  outputs?: Record<string, string>;
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps: WorkflowStep[];
};
type WebsiteWorkflow = {
  on: {
    push: { branches: string[]; paths: string[] };
    pull_request: null;
    release: { types: string[] };
    workflow_run: { workflows: string[]; types: string[] };
    workflow_dispatch: unknown;
  };
  permissions: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
};

const websiteWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/website.yml", "utf8"),
) as WebsiteWorkflow;
const buildSteps = websiteWorkflow.jobs.build?.steps ?? [];

/** Every step of a job checks the changed paths, so the job reports as a no-op when unaffected. */
const affectedCondition = "needs.changes.outputs.is_affected == 'true'";
const changedPathPatterns = String(
  websiteWorkflow.jobs.changes?.steps.find((step) => step.id === "changed-paths")
    ?.with?.paths ?? "",
)
  .split("\n")
  .filter((pattern) => pattern !== "");

function findBuildStep(stepName: string): WorkflowStep | undefined {
  return buildSteps.find((step) => step.name === stepName);
}

describe("Website workflow", () => {
  test("WS-01.1 pull requests build and test the site, and only pushes to develop, releases and Run workflow deploy", () => {
    expect(websiteWorkflow.on.push.branches).toEqual(["develop"]);
    expect(websiteWorkflow.on).toHaveProperty("pull_request");
    expect(changedPathPatterns).toContain("website/**");
    expect(changedPathPatterns).toContain("docs/wiki/**");
    expect(websiteWorkflow.on.release.types).toEqual(["published"]);
    expect(websiteWorkflow.on).toHaveProperty("workflow_dispatch");

    for (const testStepName of [
      "Unit tests (snippets, docs versions)",
      "Landing, docs and API playground tests (WS-02, WS-03.3, WS-04)",
    ]) {
      expect(findBuildStep(testStepName)?.if).toBe(affectedCondition);
    }

    expect(
      findBuildStep("Build every docs version, each with its demo")?.if,
    ).toBe(affectedCondition);
    expect(findBuildStep("Upload")?.uses).toStartWith(
      "actions/upload-pages-artifact@",
    );
    expect(findBuildStep("Upload")?.if).toBe(
      `\${{ (github.event_name != 'pull_request') && ${affectedCondition} }}`,
    );
  });

  test("WS-01.1 only the deploy job may publish to GitHub Pages, after the build", () => {
    const deployJob = websiteWorkflow.jobs.deploy;
    expect(deployJob?.if).toBe(
      "${{ !cancelled() && github.event_name != 'pull_request' && needs.build.result == 'success' }}",
    );
    expect(deployJob?.needs).toEqual(["changes", "build"]);
    expect(deployJob?.permissions).toEqual({
      pages: "write",
      "id-token": "write",
    });
    expect(deployJob?.steps.map((step) => step.if)).toEqual([affectedCondition]);
    expect(deployJob?.steps.map((step) => step.uses)).toEqual([
      "actions/deploy-pages@v5",
    ]);

    expect(websiteWorkflow.permissions).toEqual({ contents: "read" });
    const jobsWithPagesWrite = Object.entries(websiteWorkflow.jobs)
      .filter(([, workflowJob]) => workflowJob.permissions?.pages === "write")
      .map(([jobName]) => jobName);
    expect(jobsWithPagesWrite).toEqual(["deploy"]);
  });

  test("deploys after Publish beta or Publish stable publishes a release, which the release trigger never sees", () => {
    expect(websiteWorkflow.on.workflow_run).toEqual({
      workflows: ["Publish beta", "Publish stable"],
      types: ["completed"],
    });

    const releaseCheck = websiteWorkflow.jobs["release-check"];
    expect(releaseCheck?.if).toBe("github.event_name == 'workflow_run'");
    expect(releaseCheck?.outputs?.should_deploy).toBe(
      "${{ steps.decision.outputs.should_publish }}",
    );
    const decisionScript =
      releaseCheck?.steps.find((step) => step.run !== undefined)?.run ?? "";
    expect(decisionScript).toContain(
      "scripts/release/registry-publish-plan.ts",
    );

    const packageRepository = websiteWorkflow.jobs["package-repository"];
    expect(packageRepository?.needs).toEqual(["changes", "release-check"]);
    expect(packageRepository?.if).toBe(
      "${{ !cancelled() && (needs.release-check.result == 'skipped' || needs.release-check.outputs.should_deploy == 'true') }}",
    );
    expect(websiteWorkflow.jobs.build?.needs).toEqual([
      "changes",
      "package-repository",
    ]);
  });

  test("WS-03.1 every build, pull requests included, tests the versioned site before it is uploaded", () => {
    const stepNames = buildSteps.map((step) => step.name);
    const versionedTests = findBuildStep(
      "Versioned site tests (WS-03.1, WS-03.7)",
    );
    expect(versionedTests?.if).toBe(affectedCondition);
    expect(versionedTests?.run).toBe("bun run test:versioned");
    expect(
      stepNames.indexOf("Versioned site tests (WS-03.1, WS-03.7)"),
    ).toBeGreaterThan(
      stepNames.indexOf("Build every docs version, each with its demo"),
    );
    expect(stepNames.indexOf("Upload")).toBeGreaterThan(
      stepNames.indexOf("Versioned site tests (WS-03.1, WS-03.7)"),
    );
  });

  test("a skipped release check does not skip the build and deploy on pull requests and pushes", () => {
    expect(websiteWorkflow.jobs.build?.if).toBe(
      "${{ !cancelled() && needs.package-repository.result == 'success' }}",
    );
    expect(websiteWorkflow.jobs.deploy?.if).toContain(
      "needs.build.result == 'success'",
    );
  });

  test("a changelog change builds and tests the site, so a release pull request runs the changelog test", () => {
    expect(changedPathPatterns).toContain("CHANGELOG.md");
    expect(websiteWorkflow.on.push.paths).toContain("CHANGELOG.md");
  });
});
