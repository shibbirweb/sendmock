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
