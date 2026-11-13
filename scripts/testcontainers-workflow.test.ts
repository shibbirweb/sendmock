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
    expect(Object.keys(publishWorkflow.jobs).sort()).toEqual(["go", "java"]);
    // npm, PyPI and NuGet use trusted publishing, which only works from a top-level workflow.
    const registryJobNames = Object.keys(
      (
        Bun.YAML.parse(
          readFileSync(".github/workflows/registry-publish.yml", "utf8"),
        ) as { jobs: Record<string, unknown> }
      ).jobs,
    );
    expect(registryJobNames).toContain("testcontainers-node");
    expect(registryJobNames).toContain("testcontainers-python");
    expect(registryJobNames).toContain("testcontainers-dotnet");
    expect(readFileSync(".github/workflows/release.yml", "utf8")).toContain(
      "uses: ./.github/workflows/testcontainers-publish.yml",
    );
  });

  test("DS-06.1 the Java module's Central bundle is built before a release and holds only the version folder", () => {
    const javaPack =
      (moduleEntries as (ModuleEntry & { pack?: string })[]).find(
        (moduleEntry) => moduleEntry.module === "Java",
      )?.pack ?? "";
    const centralPluginVersion =
      /<artifactId>central-publishing-maven-plugin<\/artifactId>\s*<version>(\d+)\.(\d+)\.\d+<\/version>/.exec(
        readFileSync("testcontainers/java/pom.xml", "utf8"),
      );

    expect(javaPack).toContain("-DskipUpload deploy");
    expect(javaPack).toContain(
      '! grep -v -E "^io/github/shibbirweb/sendmock-testcontainers/[^/]+/[^/]+$"',
    );
    // 0.12.0 is the first version that leaves Maven 3.10's maven-metadata-local.xml out.
    expect(Number(centralPluginVersion?.[1])).toBe(0);
    expect(Number(centralPluginVersion?.[2])).toBeGreaterThanOrEqual(12);
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
