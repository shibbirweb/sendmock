import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { releaseBumps } from "../version/next-version";

type WorkflowInput = { type?: string; default?: unknown; options?: string[] };
type Workflow = {
  on: {
    workflow_dispatch?: { inputs?: Record<string, WorkflowInput> };
    workflow_call?: { inputs?: Record<string, WorkflowInput> };
    workflow_run?: {
      workflows?: string[];
      types?: string[];
      branches?: string[];
    };
  };
  jobs: Record<
    string,
    {
      if?: string;
      strategy?: { matrix?: { include?: Record<string, string>[] } };
    }
  >;
};

function readWorkflow(fileName: string): Workflow {
  const workflowPath = join(
    import.meta.dir,
    "../../.github/workflows",
    fileName,
  );
  return Bun.YAML.parse(readFileSync(workflowPath, "utf8")) as Workflow;
}

describe("Prepare release", () => {
  const prepareWorkflow = readWorkflow("release-prepare.yml");
  const dispatchInputs = prepareWorkflow.on.workflow_dispatch?.inputs ?? {};

  test("DS-05.3 offers exactly the bump choices of plan 16", () => {
    expect(dispatchInputs.bump?.options).toEqual(releaseBumps);
  });

  test("DS-04.5 has a dry run, on by default", () => {
    expect(dispatchInputs.dry_run).toEqual(
      expect.objectContaining({ type: "boolean", default: true }),
    );
  });
});

describe("the publish workflows", () => {
  const publishWorkflows = {
    "beta-publish.yml": "develop",
    "stable-promote.yml": "develop",
    "stable-publish.yml": "main",
  };

  for (const [fileName, branchName] of Object.entries(publishWorkflows)) {
    test(`DS-04.4 ${fileName} acts only after CI passed on a push to ${branchName}`, () => {
      const workflow = readWorkflow(fileName);
      const firstJob = Object.values(workflow.jobs)[0];

      expect(workflow.on.workflow_run).toEqual({
        workflows: ["CI"],
        types: ["completed"],
        branches: [branchName],
      });
      expect(firstJob?.if).toContain(
        "github.event.workflow_run.conclusion == 'success'",
      );
    });
  }
});

describe("Release build", () => {
  const releaseWorkflow = readWorkflow("release.yml");

  test("DS-04.5 a manual run builds and tests without publishing unless asked", () => {
    expect(releaseWorkflow.on.workflow_dispatch?.inputs?.publish).toEqual(
      expect.objectContaining({ type: "boolean", default: false }),
    );
    expect(releaseWorkflow.jobs.publish?.if).toBe("inputs.publish");
  });

  test("tests each of the six targets on a runner of its own operating system and CPU", () => {
    const testedTargets = Object.fromEntries(
      (releaseWorkflow.jobs.test?.strategy?.matrix?.include ?? []).map(
        (entry) => [entry.target, entry.runner],
      ),
    );

    expect(testedTargets).toEqual({
      "aarch64-apple-darwin": "macos-latest",
      "x86_64-apple-darwin": "macos-15-intel",
      "x86_64-unknown-linux-musl": "ubuntu-latest",
      "aarch64-unknown-linux-musl": "ubuntu-24.04-arm",
      "x86_64-pc-windows-msvc": "windows-latest",
      "aarch64-pc-windows-msvc": "windows-11-arm",
    });
  });
});

describe("Docker edge", () => {
  const dockerEdgeWorkflow = readWorkflow("docker-edge.yml") as Workflow & {
    on: { push?: { branches?: string[] } };
  };

  test("DS-02.1 builds and tests the image for amd64 and arm64, each on its own runner", () => {
    const builtPlatforms = Object.fromEntries(
      (dockerEdgeWorkflow.jobs.image?.strategy?.matrix?.include ?? []).map(
        (entry) => [entry.platform, entry.runner],
      ),
    );

    expect(builtPlatforms).toEqual({
      "linux/amd64": "ubuntu-latest",
      "linux/arm64": "ubuntu-24.04-arm",
    });
  });

  test("pushes and signs edge only for pushes to develop", () => {
    expect(dockerEdgeWorkflow.on.push?.branches).toEqual(["develop"]);
    expect(dockerEdgeWorkflow.jobs.manifest?.if).toBe(
      "github.event_name == 'push'",
    );
  });
});
