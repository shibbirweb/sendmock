import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseRunJobs, planRegistryPublish } from "./registry-publish-plan";

const workflowsDirectory = join(import.meta.dir, "../../.github/workflows");

type RegistryWorkflow = {
  on: { workflow_run?: { workflows?: string[]; types?: string[] } };
  jobs: Record<
    string,
    {
      if?: string;
      needs?: string[] | string;
      permissions?: Record<string, string>;
      steps?: { uses?: string; run?: string; with?: Record<string, string> }[];
    }
  >;
};

const registryWorkflow = Bun.YAML.parse(
  readFileSync(join(workflowsDirectory, "registry-publish.yml"), "utf8"),
) as RegistryWorkflow;

describe("the registry publish plan", () => {
  const publishedBeta = [
    { name: "decide", conclusion: "success" },
    { name: "release / Publish v0.2.0-beta.1", conclusion: "success" },
    { name: "release / homebrew / Homebrew formula", conclusion: "failure" },
  ];

  test("DS-03.8 publishes the release a publish run published, even if another channel failed", () => {
    expect(planRegistryPublish("Publish beta", publishedBeta)).toEqual({
      shouldPublish: true,
      tagName: "v0.2.0-beta.1",
      version: "0.2.0-beta.1",
      channel: "beta",
    });
  });

  test("DS-03.8 publishes nothing when the run released nothing or its publish job failed", () => {
    expect(
      planRegistryPublish("Publish beta", [{ name: "decide", conclusion: "success" }]),
    ).toEqual({ shouldPublish: false, reason: "the run published no release" });
    expect(
      planRegistryPublish("Publish stable", [
        { name: "release / Publish v1.0.0", conclusion: "failure" },
      ]),
    ).toEqual({ shouldPublish: false, reason: "release / Publish v1.0.0 ended failure" });
  });

  test("DS-03.8 refuses a version from the other channel and an unknown workflow", () => {
    expect(planRegistryPublish("Publish stable", publishedBeta).shouldPublish).toBe(false);
    expect(planRegistryPublish("CI", publishedBeta).shouldPublish).toBe(false);
  });

  test("reads the jobs gh prints, one JSON object per line", () => {
    expect(
      parseRunJobs('{"name":"decide","conclusion":"success"}\n\n{"name":"b","conclusion":null}\n'),
    ).toEqual([
      { name: "decide", conclusion: "success" },
      { name: "b", conclusion: null },
    ]);
  });
});

describe("the Registry publish workflow", () => {
  test("DS-03.8 runs at the top level after a beta or stable publish run, gated by the plan", () => {
    const planRun = (registryWorkflow.jobs.plan?.steps ?? [])
      .map((step) => step.run ?? "")
      .join("\n");

    expect(registryWorkflow.on.workflow_run?.workflows).toEqual([
      "Publish beta",
      "Publish stable",
    ]);
    expect(registryWorkflow.on.workflow_run?.types).toEqual(["completed"]);
    expect(planRun).toContain("scripts/release/registry-publish-plan.ts");
    for (const [jobName, job] of Object.entries(registryWorkflow.jobs)) {
      if (jobName !== "plan") {
        expect(job.if ?? "", jobName).toContain(
          "needs.plan.outputs.should_publish == 'true'",
        );
      }
    }
  });

  test("DS-03.8 holds every trusted publishing job, each with an OIDC token", () => {
    expect(Object.keys(registryWorkflow.jobs).sort()).toEqual([
      "crates",
      "mcp-registry",
      "npm",
      "plan",
      "testcontainers-node",
      "testcontainers-python",
    ]);
    for (const jobName of ["npm", "crates", "mcp-registry", "testcontainers-node", "testcontainers-python"]) {
      expect(registryWorkflow.jobs[jobName]?.permissions?.["id-token"], jobName).toBe("write");
    }
  });

  test("DS-03.8 downloads the release's own artifacts from the run that built them", () => {
    const artifactDownloads = Object.values(registryWorkflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.uses?.startsWith("actions/download-artifact@"));

    expect(artifactDownloads.map((step) => step.with?.name).sort()).toEqual([
      "release-files",
      "release-web-dist",
    ]);
    for (const download of artifactDownloads) {
      expect(download.with?.["run-id"]).toBe("${{ env.RELEASE_RUN_ID }}");
    }
  });

  test("DS-03.8 no other workflow publishes to npm, PyPI or crates.io", () => {
    const trustedPublishingCommands = [
      "npm publish",
      "pypa/gh-action-pypi-publish",
      "crates-io-auth-action",
      // `cargo publish --dry-run` in Release build checks the packages; only a real publish
      // needs a registry token.
      "CARGO_REGISTRY_TOKEN",
    ];
    const otherWorkflowTexts = readdirSync(workflowsDirectory)
      .filter((fileName) => fileName !== "registry-publish.yml")
      .map((fileName) => readFileSync(join(workflowsDirectory, fileName), "utf8"));

    for (const command of trustedPublishingCommands) {
      expect(
        otherWorkflowTexts.some((workflowText) => workflowText.includes(command)),
        command,
      ).toBe(false);
    }
  });
});
