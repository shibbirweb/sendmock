#!/usr/bin/env bun
/**
 * Decides whether Registry publish has a release to send to npm, PyPI, crates.io and the MCP
 * registry (docs/plan/30-phase-5.md, W18): only when the publish run that triggered it actually
 * published a release, so a run that found nothing to release never sends an old version again.
 *
 *     bun scripts/release/registry-publish-plan.ts <triggering workflow name> <jobs file>
 *
 * The jobs file holds one JSON object per line with each job's `name` and `conclusion`, as
 * `gh api --paginate .../runs/<run id>/jobs --jq '.jobs[] | {name, conclusion}'` prints them.
 * Writes `should_publish`, `tag_name`, `version` and `channel` to `$GITHUB_OUTPUT` when set.
 */

import { appendFileSync, readFileSync } from "node:fs";

export type RunJob = { name: string; conclusion: string | null };

export type RegistryPublishPlan =
  | { shouldPublish: false; reason: string }
  | {
      shouldPublish: true;
      tagName: string;
      version: string;
      channel: "beta" | "stable";
    };

const channelsByWorkflowName: Record<string, "beta" | "stable"> = {
  "Publish beta": "beta",
  "Publish stable": "stable",
};

/** The publish job of `release.yml`, as it is named inside the publish workflow's `release` job. */
const publishJobNamePattern = /^release \/ Publish (v\S+)$/;

export function planRegistryPublish(
  workflowName: string,
  runJobs: RunJob[],
): RegistryPublishPlan {
  const channel = channelsByWorkflowName[workflowName];
  if (channel === undefined) {
    return { shouldPublish: false, reason: `${workflowName} does not publish releases` };
  }
  const publishJob = runJobs.find((runJob) => publishJobNamePattern.test(runJob.name));
  if (publishJob === undefined) {
    return { shouldPublish: false, reason: "the run published no release" };
  }
  if (publishJob.conclusion !== "success") {
    return {
      shouldPublish: false,
      reason: `${publishJob.name} ended ${publishJob.conclusion ?? "without a conclusion"}`,
    };
  }
  const tagName = publishJobNamePattern.exec(publishJob.name)?.[1] ?? "";
  const version = tagName.slice(1);
  const isBetaVersion = version.includes("-beta.");
  if (isBetaVersion !== (channel === "beta")) {
    return {
      shouldPublish: false,
      reason: `${tagName} does not belong to the ${channel} channel`,
    };
  }
  return { shouldPublish: true, tagName, version, channel };
}

export function parseRunJobs(jobLines: string): RunJob[] {
  return jobLines
    .split("\n")
    .filter((jobLine) => jobLine.trim() !== "")
    .map((jobLine) => JSON.parse(jobLine) as RunJob);
}

function writeOutputs(registryPublishPlan: RegistryPublishPlan) {
  const outputLines = registryPublishPlan.shouldPublish
    ? [
        "should_publish=true",
        `tag_name=${registryPublishPlan.tagName}`,
        `version=${registryPublishPlan.version}`,
        `channel=${registryPublishPlan.channel}`,
      ]
    : ["should_publish=false"];
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath !== undefined) {
    appendFileSync(outputPath, `${outputLines.join("\n")}\n`);
  }
}

if (import.meta.main) {
  const [workflowName, jobsFilePath] = process.argv.slice(2);
  if (workflowName === undefined || jobsFilePath === undefined) {
    console.error(
      "Usage: bun scripts/release/registry-publish-plan.ts <workflow name> <jobs file>",
    );
    process.exit(1);
  }
  const registryPublishPlan = planRegistryPublish(
    workflowName,
    parseRunJobs(readFileSync(jobsFilePath, "utf8")),
  );
  console.log(
    registryPublishPlan.shouldPublish
      ? `Publishing ${registryPublishPlan.tagName} (${registryPublishPlan.channel}) to the registries`
      : `Nothing to publish: ${registryPublishPlan.reason}`,
  );
  writeOutputs(registryPublishPlan);
}
