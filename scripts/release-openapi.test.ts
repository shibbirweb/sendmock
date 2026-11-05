import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type ReleaseStep = { name?: string; run?: string };
type ReleaseWorkflow = { jobs: { publish: { steps: ReleaseStep[] } } };

const releaseWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/release.yml", "utf8"),
) as ReleaseWorkflow;

describe("Release build", () => {
  test("PL-01.5 the publish job attaches openapi.yaml beside the binaries", () => {
    const publishSteps = releaseWorkflow.jobs.publish.steps;
    const copyIndex = publishSteps.findIndex((step) =>
      step.run?.includes("cp docs/api/openapi.yaml dist/openapi.yaml"),
    );
    const uploadIndex = publishSteps.findIndex((step) =>
      step.run?.includes('gh release upload "$TAG_NAME" dist/*'),
    );

    expect(copyIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(copyIndex);
  });
});
