// Reads the workflows that run on pull requests and the "passed" gate each one ends with. The
// gates are the repository's required checks: every job of a workflow reports through its gate.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workflowFolder = ".github/workflows";
export const gateJobId = "passed";
export const changesJobId = "changes";

type WorkflowJob = {
  name?: string;
  needs?: string | string[];
  if?: string;
};

export type PullRequestWorkflow = {
  fileName: string;
  name: string;
  pullRequestPaths: string[];
  jobs: Record<string, WorkflowJob>;
};

type WorkflowFile = {
  name?: string;
  on?: Record<string, { paths?: string[]; types?: string[] } | null>;
  jobs?: Record<string, WorkflowJob>;
};

/** Workflows started by every pull request: not ones only a label or a closed pull request starts. */
export function readPullRequestWorkflows(): PullRequestWorkflow[] {
  return readdirSync(workflowFolder)
    .filter((fileName) => fileName.endsWith(".yml"))
    .sort()
    .flatMap((fileName) => {
      const workflowFile = Bun.YAML.parse(
        readFileSync(join(workflowFolder, fileName), "utf8"),
      ) as WorkflowFile;
      const triggers = workflowFile.on ?? {};
      if (!("pull_request" in triggers)) {
        return [];
      }
      const pullRequestTrigger = triggers.pull_request ?? {};
      if ((pullRequestTrigger.types ?? []).length > 0) {
        return [];
      }
      return [
        {
          fileName,
          name: workflowFile.name ?? fileName,
          pullRequestPaths: pullRequestTrigger.paths ?? [],
          jobs: workflowFile.jobs ?? {},
        },
      ];
    });
}

export function readNeeds(workflowJob: WorkflowJob): string[] {
  return [workflowJob.needs ?? []].flat();
}

/** Why a workflow's gate would not stand for all of its jobs; empty when it does. */
export function findGateProblems(workflow: PullRequestWorkflow): string[] {
  const problems: string[] = [];
  const gateJob = workflow.jobs[gateJobId];
  if (workflow.pullRequestPaths.length > 0) {
    problems.push("filters pull requests by path, so its gate would not report on every one");
  }
  if (gateJob === undefined) {
    return [...problems, `has no "${gateJobId}" job`];
  }
  if (gateJob.name !== `${workflow.name} passed`) {
    problems.push(`its gate is named "${gateJob.name}", not "${workflow.name} passed"`);
  }
  if (gateJob.if !== "always()") {
    problems.push("its gate does not run always()");
  }
  const gateNeeds = new Set(readNeeds(gateJob));
  for (const jobId of Object.keys(workflow.jobs)) {
    if (jobId !== gateJobId && !gateNeeds.has(jobId)) {
      problems.push(`its gate does not wait for ${jobId}`);
    }
  }
  if (changesJobId in workflow.jobs) {
    for (const [jobId, workflowJob] of Object.entries(workflow.jobs)) {
      const isRootJob = jobId !== changesJobId && jobId !== gateJobId && readNeeds(workflowJob).length === 0;
      if (isRootJob) {
        problems.push(`${jobId} does not wait for the changed paths`);
      }
    }
  }
  return problems;
}

/** The required checks: one gate per pull request workflow. */
export function listRequiredChecks(): string[] {
  return readPullRequestWorkflows().map((workflow) => `${workflow.name} passed`);
}
