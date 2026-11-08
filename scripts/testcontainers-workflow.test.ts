import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type ModuleEntry = { module: string; folder: string; run: string };

const testcontainersWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/testcontainers.yml", "utf8"),
) as {
  env: { SENDMOCK_IMAGE: string };
  jobs: { module: { strategy: { matrix: { include: ModuleEntry[] } } } };
};
const moduleEntries =
  testcontainersWorkflow.jobs.module.strategy.matrix.include;

describe("Testcontainers workflow", () => {
  test("DS-06.1 DS-06.2 tests the Java, Node, Go, Python and .NET modules against the image from the commit", () => {
    expect(moduleEntries.map((moduleEntry) => moduleEntry.module)).toEqual([
      "Java",
      "Node",
      "Go",
      "Python",
      ".NET",
    ]);
    expect(testcontainersWorkflow.env.SENDMOCK_IMAGE).toBe(
      "sendmock:testcontainers",
    );
    for (const moduleEntry of moduleEntries) {
      expect(existsSync(`testcontainers/${moduleEntry.folder}`)).toBe(true);
    }
  });
});

describe("Testcontainers publish", () => {
  const publishWorkflow = Bun.YAML.parse(
    readFileSync(".github/workflows/testcontainers-publish.yml", "utf8"),
  ) as { jobs: Record<string, unknown> };

  test("DS-06.1 every module is packaged as its registry would before a release, and published after it", () => {
    for (const moduleEntry of moduleEntries as (ModuleEntry & {
      pack?: string;
    })[]) {
      expect(moduleEntry.pack?.length ?? 0).toBeGreaterThan(0);
    }
    expect(Object.keys(publishWorkflow.jobs).sort()).toEqual([
      "dotnet",
      "go",
      "java",
    ]);
    // npm and PyPI use trusted publishing, which only works from a top-level workflow.
    const registryJobNames = Object.keys(
      (
        Bun.YAML.parse(
          readFileSync(".github/workflows/registry-publish.yml", "utf8"),
        ) as { jobs: Record<string, unknown> }
      ).jobs,
    );
    expect(registryJobNames).toContain("testcontainers-node");
    expect(registryJobNames).toContain("testcontainers-python");
    expect(readFileSync(".github/workflows/release.yml", "utf8")).toContain(
      "uses: ./.github/workflows/testcontainers-publish.yml",
    );
  });

  test("DS-06.1 each module defaults to the SendMock image of its own version", () => {
    const workspaceVersion =
      /\[workspace\.package\][^[]*?\nversion = "([^"]+)"/.exec(
        readFileSync("Cargo.toml", "utf8"),
      )?.[1];
    expect(readFileSync("testcontainers/go/sendmock.go", "utf8")).toContain(
      `ghcr.io/shibbirweb/sendmock:${workspaceVersion}"`,
    );
  });
});
