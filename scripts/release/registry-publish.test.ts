import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseRunJobs, planRegistryPublish } from "./registry-publish-plan";

const workflowsDirectory = join(import.meta.dir, "../../.github/workflows");

type RegistryWorkflow = {
  on: {
    workflow_run?: { workflows?: string[]; types?: string[] };
    workflow_dispatch?: {
      inputs?: Record<
        string,
        { required?: boolean; type?: string; default?: string; options?: string[] }
      >;
    };
  };
  env?: Record<string, string>;
  jobs: Record<
    string,
    {
      if?: string;
      needs?: string[] | string;
      permissions?: Record<string, string>;
      env?: Record<string, string>;
      steps?: {
        uses?: string;
        run?: string;
        if?: string;
        with?: Record<string, string>;
        env?: Record<string, string>;
      }[];
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
      releaseBranch: "develop",
    });
  });

  test("DS-03.8 names the branch each channel releases from, main for a stable", () => {
    expect(
      planRegistryPublish("Publish stable", [
        { name: "release / Publish v1.0.0", conclusion: "success" },
      ]),
    ).toEqual({
      shouldPublish: true,
      tagName: "v1.0.0",
      version: "1.0.0",
      channel: "stable",
      releaseBranch: "main",
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

  test("DS-03.8 the plan runs the default branch's code, never the triggering commit's", () => {
    const planCheckout = (registryWorkflow.jobs.plan?.steps ?? []).find((step) =>
      step.uses?.startsWith("actions/checkout"),
    );

    expect(planCheckout).toBeDefined();
    expect(planCheckout?.with?.ref).toBeUndefined();
  });

  test("DS-03.8 publishes only when the release tag points at a commit CI passed on its branch", () => {
    const tagCheck = (registryWorkflow.jobs.plan?.steps ?? []).find((step) =>
      step.run?.includes("commits/refs/tags/$TAG_NAME"),
    );

    expect(tagCheck?.env?.RELEASE_BRANCH).toBe("${{ steps.decision.outputs.release_branch }}");
    expect(tagCheck?.run).toContain(
      "actions/workflows/ci.yml/runs?head_sha=$tagged_commit&branch=$RELEASE_BRANCH&event=push&status=success",
    );
    expect(tagCheck?.run).toContain('if [ "$passed_ci_run_count" = "0" ]; then');
    expect(tagCheck?.run).toContain("exit 1");
  });

  // A workflow_run run is recorded on the default branch head, so its head_sha is develop's
  // latest commit, never the merge commit on main that a stable tag points at.
  test("DS-03.8 never compares the tag with the publish run's head commit", () => {
    const workflowText = readFileSync(join(workflowsDirectory, "registry-publish.yml"), "utf8");

    expect(workflowText).not.toContain("workflow_run.head_sha");
  });

  test("DS-03.8 sends a missed release again by hand, from the default branch only", () => {
    const releaseRunIdInput = registryWorkflow.on.workflow_dispatch?.inputs?.release_run_id;
    const decisionStep = (registryWorkflow.jobs.plan?.steps ?? []).find((step) =>
      step.run?.includes("registry-publish-plan.ts"),
    );
    const decisionRun = decisionStep?.run ?? "";

    expect(releaseRunIdInput?.required).toBe(true);
    expect(registryWorkflow.env?.RELEASE_RUN_ID).toBe(
      "${{ github.event.workflow_run.id || inputs.release_run_id }}",
    );
    expect(registryWorkflow.jobs.plan?.if).toBe(
      "github.event_name != 'workflow_dispatch' || github.ref_name == github.event.repository.default_branch",
    );
    expect(decisionRun).toContain('if ! [[ "$RELEASE_RUN_ID" =~ ^[0-9]+$ ]]; then');
    expect(decisionRun).toContain('actions/runs/$RELEASE_RUN_ID" --jq .name');
  });

  test("DS-03.8 every publishing job checks out the verified release tag", () => {
    for (const [jobName, job] of Object.entries(registryWorkflow.jobs)) {
      if (jobName === "plan" || jobName === "crates-handoff") {
        continue;
      }
      const checkout = (job.steps ?? []).find((step) =>
        step.uses?.startsWith("actions/checkout"),
      );
      expect(checkout?.with?.ref, jobName).toBe(
        "refs/tags/${{ needs.plan.outputs.tag_name }}",
      );
    }
  });

  test("DS-03.8 holds every trusted publishing job, each with an OIDC token", () => {
    expect(Object.keys(registryWorkflow.jobs).sort()).toEqual([
      "crates",
      "crates-handoff",
      "mcp-registry",
      "npm",
      "plan",
      "testcontainers-dotnet",
      "testcontainers-node",
      "testcontainers-python",
    ]);
    for (const jobName of [
      "npm",
      "crates",
      "mcp-registry",
      "testcontainers-dotnet",
      "testcontainers-node",
      "testcontainers-python",
    ]) {
      expect(registryWorkflow.jobs[jobName]?.permissions?.["id-token"], jobName).toBe("write");
    }
  });

  test("DS-03.8 npm uses OIDC unless the first publish's NPM_TOKEN is set", () => {
    for (const jobName of ["npm", "testcontainers-node"]) {
      const jobSteps = registryWorkflow.jobs[jobName]?.steps ?? [];
      const setupNode = jobSteps.find((step) => step.uses?.startsWith("actions/setup-node@"));
      const runText = jobSteps.map((step) => step.run ?? "").join("\n");

      // An empty `_authToken=${NODE_AUTH_TOKEN}` line from registry-url makes npm skip OIDC.
      expect(setupNode?.with?.["registry-url"], jobName).toBeUndefined();
      expect(runText, jobName).toContain('if [ -n "$NPM_TOKEN" ]; then');
      // 11.21.0 is the first npm 11 whose `npm dist-tag` signs in with OIDC, which moves `latest`.
      expect(runText, jobName).toContain("npm install -g npm@^11.21.0");
    }
  });

  test("DS-03.8 crates.io uses OIDC unless the first publish's CARGO_REGISTRY_TOKEN is set", () => {
    const cratesJob = registryWorkflow.jobs.crates;
    const cratesSteps = cratesJob?.steps ?? [];
    const oidcStep = cratesSteps.find((step) => step.uses?.startsWith("rust-lang/crates-io-auth-action@"));
    const publishStep = cratesSteps.find((step) => step.run?.includes("crates-publish.ts"));

    expect(cratesJob?.env?.HAS_FIRST_PUBLISH_TOKEN).toBe("${{ secrets.CARGO_REGISTRY_TOKEN != '' }}");
    expect(oidcStep?.if).toBe("env.HAS_FIRST_PUBLISH_TOKEN != 'true'");
    expect(publishStep?.env?.CARGO_REGISTRY_TOKEN).toBe(
      "${{ secrets.CARGO_REGISTRY_TOKEN || steps.crates-io-auth.outputs.token }}",
    );
    expect(publishStep?.run).toBe("bun scripts/release/crates-publish.ts");
  });

  // crates.io trusted publishing refuses a token from a `workflow_run` run, so a stable reaches
  // crates.io through a hand-started run of this file that sends only the crates.
  test("DS-03.8 crates.io publishes only from a hand-started run, which a workflow_run run starts for a stable", () => {
    const registriesInput = registryWorkflow.on.workflow_dispatch?.inputs?.registries;
    const handoffJob = registryWorkflow.jobs["crates-handoff"];
    const handoffRun = (handoffJob?.steps ?? []).map((step) => step.run ?? "").join("\n");

    expect(registriesInput?.type).toBe("choice");
    expect(registriesInput?.default).toBe("all");
    expect(registriesInput?.options).toEqual(["all", "crates"]);
    expect(registryWorkflow.jobs.crates?.if).toStartWith(
      "github.event_name == 'workflow_dispatch' && ",
    );
    expect(handoffJob?.if).toBe(
      "github.event_name == 'workflow_run' && needs.plan.outputs.should_publish == 'true' && needs.plan.outputs.channel == 'stable' && vars.CRATES_PUBLISHING == 'true'",
    );
    expect(handoffJob?.permissions).toEqual({ actions: "write" });
    expect(handoffRun).toContain('gh workflow run registry-publish.yml --repo "$GITHUB_REPOSITORY" --ref "$DEFAULT_BRANCH"');
    expect(handoffRun).toContain('-f release_run_id="$RELEASE_RUN_ID" -f registries=crates');
  });

  test("DS-03.8 a crates-only run skips every other registry", () => {
    for (const jobName of [
      "npm",
      "mcp-registry",
      "testcontainers-dotnet",
      "testcontainers-node",
      "testcontainers-python",
    ]) {
      expect(registryWorkflow.jobs[jobName]?.if, jobName).toStartWith(
        "inputs.registries != 'crates' && ",
      );
    }
  });

  test("DS-03.8 every npm package goes through npm-publish.ts, which stages a package's first version", () => {
    for (const jobName of ["npm", "testcontainers-node"]) {
      const runText = (registryWorkflow.jobs[jobName]?.steps ?? [])
        .map((step) => step.run ?? "")
        .join("\n");

      expect(runText, jobName).toContain("scripts/release/npm-publish.ts");
      expect(runText, jobName).not.toContain("npm publish");
    }
    const npmRunText = (registryWorkflow.jobs.npm?.steps ?? [])
      .map((step) => step.run ?? "")
      .join("\n");
    expect(npmRunText).toContain("for package_directory in ./npm-packages/*/; do");
    expect(npmRunText).toContain(
      'bun scripts/release/npm-publish.ts ./npm-packages/sendmock/ "$dist_tag"',
    );
  });

  test("DS-03.8 NuGet trades the OIDC token for a short-lived key, with no stored one", () => {
    const dotnetSteps = registryWorkflow.jobs["testcontainers-dotnet"]?.steps ?? [];
    const pushRun = dotnetSteps.map((step) => step.run ?? "").join("\n");

    expect(dotnetSteps.map((step) => step.uses ?? "")).toContain("NuGet/login@v1");
    expect(pushRun).toContain("dotnet nuget push");
    expect(
      readFileSync(join(workflowsDirectory, "registry-publish.yml"), "utf8"),
    ).not.toContain("secrets.NUGET_API_KEY");
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

  test("DS-03.8 no other workflow publishes to npm, PyPI, NuGet or crates.io", () => {
    const trustedPublishingCommands = [
      "npm publish",
      "npm-publish.ts",
      "pypa/gh-action-pypi-publish",
      "dotnet nuget push",
      "NuGet/login",
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
