import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type WorkflowStep = { uses?: string; "working-directory"?: string; run?: string };
type PushSdksWorkflow = {
  jobs: { sdks: { env: Record<string, string>; steps: WorkflowStep[] } };
};

const workflow = Bun.YAML.parse(
  readFileSync(".github/workflows/push-sdks.yml", "utf8"),
) as PushSdksWorkflow;
const steps = workflow.jobs.sdks.steps;

describe("Push SDKs workflow", () => {
  test("PN-01.1 PN-01.2 PN-01.3 the three push SDKs send to a release binary run offline", () => {
    const sdkStep = steps.find((step) => step["working-directory"] === "examples/push/node");
    const startIndex = steps.findIndex(
      (step) => step.uses === "./.github/actions/start-sendmock-offline",
    );
    const checkIndex = steps.findIndex(
      (step) => step.uses === "./.github/actions/check-sendmock-offline",
    );

    expect(steps.some((step) => step.run?.includes("cargo build --release"))).toBe(true);
    expect(sdkStep?.run).toContain("node done-when.js");
    expect(workflow.jobs.sdks.env.EXPO_BASE_URL).toBe("http://127.0.0.1:8026");
    expect(existsSync("examples/push/node/done-when.js")).toBe(true);
    expect(startIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeGreaterThan(steps.indexOf(sdkStep ?? {}));
  });

  test("Release build runs the push SDKs before it publishes", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(releaseWorkflow).toContain("uses: ./.github/workflows/push-sdks.yml");
    expect(releaseWorkflow).toMatch(/needs: \[[^\]]*push-sdks/);
  });
});
