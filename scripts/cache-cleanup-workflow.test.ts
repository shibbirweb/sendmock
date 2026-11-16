import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

type WorkflowStep = { uses?: string; run?: string; with?: Record<string, string> };
type WorkflowJob = { if?: string; env?: Record<string, string>; steps?: WorkflowStep[] };
type Workflow = {
  on: Record<string, { types?: string[] } | null>;
  permissions: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
};

const workflowFolder = ".github/workflows";

function readWorkflow(fileName: string): Workflow {
  return Bun.YAML.parse(readFileSync(`${workflowFolder}/${fileName}`, "utf8")) as Workflow;
}

const cleanupWorkflow = readWorkflow("cache-cleanup.yml");
const cleanupJob = cleanupWorkflow.jobs["delete-caches"];

describe("Cache cleanup workflow", () => {
  test("runs when a pull request closes and when a branch is deleted", () => {
    expect(cleanupWorkflow.on.pull_request_target?.types).toEqual(["closed"]);
    expect(Object.keys(cleanupWorkflow.on)).toContain("delete");
    expect(cleanupJob?.if).toContain("github.event.ref_type == 'branch'");
  });

  test("deletes the caches of the closed pull request's merge ref or the deleted branch", () => {
    const cacheRef = cleanupJob?.env?.CACHE_REF ?? "";
    expect(cacheRef).toContain("refs/pull/{0}/merge");
    expect(cacheRef).toContain("github.event.pull_request.number");
    expect(cacheRef).toContain("refs/heads/{0}");
    const runCommands = (cleanupJob?.steps ?? []).map((step) => step.run ?? "").join("\n");
    expect(runCommands).toContain('gh cache list --ref "$CACHE_REF"');
    expect(runCommands).toContain("gh cache delete");
  });

  test("only deletes caches and never checks out or runs pull request code", () => {
    expect(cleanupWorkflow.permissions).toEqual({
      actions: "write",
    });
    const usedActions = (cleanupJob?.steps ?? []).map((step) => step.uses ?? "");
    expect(usedActions.filter((usedAction) => usedAction !== "")).toEqual([]);
  });
});

describe("Rust build caches", () => {
  test("every rust-cache step saves only outside pull requests, which restore them", () => {
    const rustCacheSteps = readdirSync(workflowFolder)
      .filter((fileName) => fileName.endsWith(".yml"))
      .flatMap((fileName) =>
        Object.values(readWorkflow(fileName).jobs ?? {}).flatMap((job) =>
          (job.steps ?? [])
            .filter((step) => step.uses?.startsWith("Swatinem/rust-cache@") ?? false)
            .map((step) => ({ fileName, saveIf: step.with?.["save-if"] ?? null })),
        ),
      );
    expect(rustCacheSteps.length).toBeGreaterThan(0);
    for (const rustCacheStep of rustCacheSteps) {
      expect(rustCacheStep).toEqual({
        fileName: rustCacheStep.fileName,
        saveIf: "${{ github.event_name != 'pull_request' }}",
      });
    }
  });
});
