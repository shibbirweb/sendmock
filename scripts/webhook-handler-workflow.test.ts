import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type WebhookHandlerWorkflow = {
  jobs: {
    express: { steps: { name?: string; "working-directory"?: string; run?: string }[] };
  };
};

const webhookHandlerWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/webhook-handler.yml", "utf8"),
) as WebhookHandlerWorkflow;

describe("Webhook handler workflow", () => {
  test("the Phase 3 done-when check runs the Express example against a release binary", () => {
    const steps = webhookHandlerWorkflow.jobs.express.steps;
    const checkStep = steps.find(
      (step) => step["working-directory"] === "examples/webhooks/express-handler",
    );

    expect(steps.some((step) => step.run?.includes("cargo build --release"))).toBe(true);
    expect(checkStep?.run).toContain("node done-when.js");
    expect(existsSync("examples/webhooks/express-handler/done-when.js")).toBe(true);
  });

  test("Release build runs the webhook handler check before it publishes", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(releaseWorkflow).toContain("uses: ./.github/workflows/webhook-handler.yml");
  });
});
