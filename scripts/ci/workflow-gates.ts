// Reads the workflows that run on pull requests and checks that every job reports on every pull
// request, so each check can be required: a path-filtered workflow runs its jobs as no-ops when
// the pull request did not touch its paths, and every workflow ends with a "passed" gate.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workflowFolder = ".github/workflows";
export const gateJobId = "passed";
export const changesJobId = "changes";

type WorkflowStep = { if?: string };

type WorkflowJob = {
  name?: string;
  needs?: string | string[];
  if?: string;
  uses?: string;
  steps?: WorkflowStep[];
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
    problems.push(...findNoOpProblems(workflow));
  }
  return problems;
}

const affectedCondition = "needs.changes.outputs.is_affected == 'true'";

/**
 * A path-filtered workflow runs every job on every pull request, so each check name reports:
 * each job waits for the changed paths, is never skipped because of them, and does its work only
 * in steps that check them. Release-only jobs keep their own condition.
 */
function findNoOpProblems(workflow: PullRequestWorkflow): string[] {
  const problems: string[] = [];
  for (const [jobId, workflowJob] of Object.entries(workflow.jobs)) {
    if (jobId === changesJobId || jobId === gateJobId) {
      continue;
    }
    if (!readNeeds(workflowJob).includes(changesJobId)) {
      problems.push(`${jobId} does not wait for the changed paths`);
    }
    if ((workflowJob.if ?? "").includes("is_affected")) {
      problems.push(`${jobId} is skipped as a whole when unaffected, so its check name would not report`);
    }
    const isReleaseOnly = (workflowJob.if ?? "").includes("inputs.");
    if (workflowJob.uses !== undefined || isReleaseOnly) {
      continue;
    }
    (workflowJob.steps ?? []).forEach((workflowStep, stepIndex) => {
      if (!(workflowStep.if ?? "").includes(affectedCondition)) {
        problems.push(`${jobId} step ${stepIndex + 1} runs even when the pull request did not touch its paths`);
      }
    });
  }
  return problems;
}

/** The gates, one per pull request workflow. */
export function listGateChecks(): string[] {
  return readPullRequestWorkflows().map((workflow) => `${workflow.name} passed`);
}
