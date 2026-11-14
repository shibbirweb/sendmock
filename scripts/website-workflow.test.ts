import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type WorkflowStep = {
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
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
    push: { branches: string[] };
    pull_request: { paths: string[] };
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

function findBuildStep(stepName: string): WorkflowStep | undefined {
  return buildSteps.find((step) => step.name === stepName);
}

describe("Website workflow", () => {
  test("WS-01.1 pull requests build and test the site, and only pushes to develop, releases and Run workflow deploy", () => {
    expect(websiteWorkflow.on.push.branches).toEqual(["develop"]);
    expect(websiteWorkflow.on.pull_request.paths).toContain("website/**");
    expect(websiteWorkflow.on.pull_request.paths).toContain("docs/wiki/**");
    expect(websiteWorkflow.on.release.types).toEqual(["published"]);
    expect(websiteWorkflow.on).toHaveProperty("workflow_dispatch");

    const pullRequestBuild = findBuildStep(
      "Build website with the demo at /demo/",
    );
    expect(pullRequestBuild?.if).toBe("github.event_name == 'pull_request'");
    for (const testStepName of [
      "Unit tests (snippets, docs versions)",
      "Landing, docs and API playground tests (WS-02, WS-03.3, WS-04)",
    ]) {
      expect(findBuildStep(testStepName)?.if).toBeUndefined();
    }

    const versionsBuild = findBuildStep(
      "Build every docs version, each with its demo",
    );
    expect(versionsBuild?.if).toBe("github.event_name != 'pull_request'");
    expect(findBuildStep("Upload")?.uses).toStartWith(
      "actions/upload-pages-artifact@",
    );
    expect(findBuildStep("Upload")?.if).toBe(
      "github.event_name != 'pull_request'",
    );
  });

  test("WS-01.1 only the deploy job may publish to GitHub Pages, after the build", () => {
    const deployJob = websiteWorkflow.jobs.deploy;
    expect(deployJob?.if).toBe("github.event_name != 'pull_request'");
    expect(deployJob?.needs).toBe("build");
    expect(deployJob?.permissions).toEqual({
      pages: "write",
      "id-token": "write",
    });
    expect(deployJob?.steps.map((step) => step.uses)).toEqual([
      "actions/deploy-pages@v4",
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
    expect(decisionScript).toContain("scripts/release/registry-publish-plan.ts");

    const packageRepository = websiteWorkflow.jobs["package-repository"];
    expect(packageRepository?.needs).toBe("release-check");
    expect(packageRepository?.if).toBe(
      "${{ !cancelled() && (needs.release-check.result == 'skipped' || needs.release-check.outputs.should_deploy == 'true') }}",
    );
    expect(websiteWorkflow.jobs.build?.needs).toBe("package-repository");
  });
});
