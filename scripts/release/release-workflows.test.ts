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

  test("DS-01.1 builds macOS arm64 and x64, static Linux x64 and arm64, and Windows x64 and arm64", () => {
    const builtTargets = (
      releaseWorkflow.jobs.build?.strategy?.matrix?.include ?? []
    ).map((entry) => entry.target);

    expect(builtTargets.sort()).toEqual([
      "aarch64-apple-darwin",
      "aarch64-pc-windows-msvc",
      "aarch64-unknown-linux-musl",
      "x86_64-apple-darwin",
      "x86_64-pc-windows-msvc",
      "x86_64-unknown-linux-musl",
    ]);
  });

  test("DS-01.2 DS-01.3 DS-01.4 each archive runs test cases 1 to 8, Linux also in alpine and busybox, and SHA256SUMS is published", () => {
    const testSteps =
      (releaseWorkflow.jobs as Record<string, { steps?: { run?: string }[] }>)
        .test?.steps ?? [];
    const testRunText = testSteps.map((step) => step.run ?? "").join("\n");
    const checksumRunText = (
      (releaseWorkflow.jobs as Record<string, { steps?: { run?: string }[] }>)
        .checksums?.steps ?? []
    )
      .map((step) => step.run ?? "")
      .join("\n");
    const linuxContainers = (
      releaseWorkflow.jobs.test?.strategy?.matrix?.include ?? []
    ).find((entry) => entry.target === "x86_64-unknown-linux-musl")?.containers;
    const installedChecks = readFileSync(
      join(import.meta.dir, "installed-binary-checks.ts"),
      "utf8",
    );

    expect(testRunText).toContain("bun scripts/release/check-archive.ts");
    expect(testRunText).toContain("/sendmock/sendmock version --json");
    expect(linuxContainers).toBe("alpine:3.22 busybox:1.37");
    expect(checksumRunText).toContain("SHA256SUMS");
    for (const testCase of ["2.", "3.", "4.", "5.", "6.", "7.", "8."]) {
      expect(installedChecks).toMatch(
        new RegExp(`["\`]${testCase.replace(".", "\\.")} `),
      );
    }
  });

  test("DS-01.4 tests each of the six targets on a runner of its own operating system and CPU", () => {
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

  test("pushes edge for pushes to develop, and other tags only when Release build calls it", () => {
    expect(dockerEdgeWorkflow.on.push?.branches).toEqual(["develop"]);
    expect(dockerEdgeWorkflow.jobs.manifest?.if).toBe(
      "github.event_name == 'push' || inputs.image_tags != ''",
    );
  });

  test("DS-02.5 the Docker Hub repository is made public before the first push to it", () => {
    const manifestSteps = (
      dockerEdgeWorkflow.jobs.manifest as { steps?: { name?: string; run?: string }[] }
    ).steps ?? [];
    const stepNames = manifestSteps.map((step) => step.name ?? "");
    const repositoryStep = manifestSteps.find((step) =>
      step.run?.includes("scripts/docker-hub-repository.sh"),
    );

    expect(repositoryStep?.name).toBe("The Docker Hub repository exists and is public");
    expect(stepNames.indexOf("Log in to Docker Hub")).toBeLessThan(
      stepNames.indexOf("The Docker Hub repository exists and is public"),
    );
    expect(stepNames.indexOf("The Docker Hub repository exists and is public")).toBeLessThan(
      stepNames.indexOf("The tags for both platforms"),
    );
    expect(readFileSync(join(import.meta.dir, "../docker-hub-repository.sh"), "utf8")).toContain(
      "is_private: false",
    );
    expect(repositoryStep?.run).toContain("packaging/docker/README.md");
  });

  test("DS-02.5 the Docker Hub overview fits Docker Hub and links only to absolute URLs", () => {
    const dockerHubReadme = readFileSync(
      join(import.meta.dir, "../../packaging/docker/README.md"),
      "utf8",
    );
    const linkTargets = [...dockerHubReadme.matchAll(/\]\(([^)]+)\)/g)].map(
      (linkMatch) => linkMatch[1] ?? "",
    );

    expect(dockerHubReadme.length).toBeLessThan(25_000);
    expect(dockerHubReadme).toContain("docker run --rm -p 1025:1025 -p 8025:8025 shibbirweb/sendmock");
    for (const linkTarget of linkTargets) {
      expect(linkTarget).toStartWith("https://");
    }
  });

  test("a published beta or stable gets its Docker tags, Homebrew formula and Linux packages", () => {
    const releaseJobs = readWorkflow("release.yml").jobs as Record<
      string,
      {
        if?: string;
        uses?: string;
        needs?: string[] | string;
        with?: Record<string, string>;
      }
    >;
    const publishedChannelCondition =
      "inputs.publish && (inputs.channel == 'beta' || inputs.channel == 'stable')";

    expect(releaseJobs.docker?.uses).toBe(
      "./.github/workflows/docker-edge.yml",
    );
    expect(releaseJobs.docker?.if).toBe(publishedChannelCondition);
    expect(releaseJobs.docker?.with?.image_tags).toBe(
      "${{ needs.plan.outputs.docker_tags }}",
    );
    expect(releaseJobs.homebrew?.if).toBe(publishedChannelCondition);
    expect(releaseJobs.checksums?.needs).toEqual([
      "test",
      "linux-packages",
      "linux-community-packages",
    ]);
    expect(releaseJobs.publish?.needs).toContain("smtp-clients");
  });

  test("AI-05.6 a published stable goes to the MCP registry after the npm package and the image", () => {
    const registryJobs = readWorkflow("registry-publish.yml").jobs as Record<
      string,
      {
        if?: string;
        needs?: string[];
        permissions?: Record<string, string>;
        steps?: { uses?: string; run?: string }[];
      }
    >;
    const registryJob = registryJobs["mcp-registry"];
    const registryRunText = registryJob?.steps
      ?.map((step) => step.run ?? "")
      .join("\n");

    expect(registryJob?.if).toBe(
      "needs.plan.outputs.should_publish == 'true' && needs.plan.outputs.channel == 'stable'",
    );
    expect(registryJob?.needs).toEqual(["plan", "npm"]);
    expect(registryJob?.permissions?.["id-token"]).toBe("write");
    expect(registryJob?.steps?.map((step) => step.uses ?? "")).toContain(
      "./.github/actions/install-mcp-publisher",
    );
    expect(registryRunText).toContain("docker buildx imagetools inspect");
    expect(registryRunText).toContain("mcp-publisher login github-oidc");
  });
});

describe("release pull requests and bodies in the workflows", () => {
  type CallingJob = {
    uses?: string;
    with?: Record<string, unknown>;
    steps?: { run?: string }[];
  };
  function readJobs(fileName: string) {
    return readWorkflow(fileName).jobs as Record<string, CallingJob>;
  }
  function readRunText(job: CallingJob | undefined) {
    return (job?.steps ?? []).map((step) => step.run ?? "").join("\n");
  }

  test("DS-04.1 Prepare release opens the planned pull request, and merging it publishes a beta on every channel", () => {
    const betaRelease = readJobs("beta-publish.yml").release;

    expect(readRunText(readJobs("release-prepare.yml").prepare)).toContain(
      "bun scripts/release/release.ts release-pull-request",
    );
    expect(betaRelease?.uses).toBe("./.github/workflows/release.yml");
    expect(betaRelease?.with?.channel).toBe("beta");
    expect(betaRelease?.with?.publish).toBe(true);
  });

  test("DS-04.3 Promote stable opens the planned develop to main pull request, and merging it publishes the stable", () => {
    const stableRelease = readJobs("stable-publish.yml").release;

    expect(readRunText(readJobs("stable-promote.yml").promote)).toContain(
      "bun scripts/release/release.ts promote-pull-request",
    );
    expect(stableRelease?.uses).toBe("./.github/workflows/release.yml");
    expect(stableRelease?.with?.channel).toBe("stable");
    expect(stableRelease?.with?.publish).toBe(true);
  });

  test("DS-05.5 every body comes from its section and is read back after publishing", () => {
    for (const fileName of ["beta-publish.yml", "stable-publish.yml"]) {
      expect(readRunText(readJobs(fileName).draft)).toContain(
        "bun scripts/release/release.ts release-body",
      );
    }
    const publishText = readRunText(readJobs("release.yml").publish);

    expect(publishText).toContain("--notes-file");
    expect(publishText).toContain(
      'bun scripts/release/release.ts check-release-body "$VERSION"',
    );
    expect(publishText).not.toContain("--notes ");
  });
});
