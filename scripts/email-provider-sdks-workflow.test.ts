import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type WorkflowStep = { uses?: string; "working-directory"?: string; run?: string };
type EmailProviderSdksWorkflow = { jobs: { sdks: { steps: WorkflowStep[] } } };

const workflow = Bun.YAML.parse(
  readFileSync(".github/workflows/email-provider-sdks.yml", "utf8"),
) as EmailProviderSdksWorkflow;
const steps = workflow.jobs.sdks.steps;

describe("Email provider SDKs workflow", () => {
  test("EM-08.5 the six SDKs send to a release binary run offline", () => {
    const sdkStep = steps.find(
      (step) => step["working-directory"] === "examples/email-providers/node",
    );
    const startIndex = steps.findIndex(
      (step) => step.uses === "./.github/actions/start-sendmock-offline",
    );
    const checkIndex = steps.findIndex(
      (step) => step.uses === "./.github/actions/check-sendmock-offline",
    );

    expect(steps.some((step) => step.run?.includes("cargo build --release"))).toBe(true);
    expect(sdkStep?.run).toContain("node done-when.js");
    expect(existsSync("examples/email-providers/node/done-when.js")).toBe(true);
    expect(startIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeGreaterThan(steps.indexOf(sdkStep ?? {}));
  });

  test("Release build runs the email provider SDKs before it publishes", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(releaseWorkflow).toContain("uses: ./.github/workflows/email-provider-sdks.yml");
  });
});
