import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type WorkflowStep = {
  name?: string;
  uses?: string;
  "working-directory"?: string;
  run?: string;
};
type PaymentAppsWorkflow = {
  jobs: { apps: { steps: WorkflowStep[] } };
};

const paymentAppsWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/payment-apps.yml", "utf8"),
) as PaymentAppsWorkflow;
const steps = paymentAppsWorkflow.jobs.apps.steps;

function findExampleStep(exampleFolder: string) {
  return steps.find(
    (step) =>
      step["working-directory"] === `examples/payments/${exampleFolder}`,
  );
}

describe("Payment apps workflow", () => {
  test("PY-10.2 the Stripe, PayPal, SSLCommerz and Razorpay apps run against a release binary", () => {
    expect(
      steps.some((step) => step.run?.includes("cargo build --release")),
    ).toBe(true);
    expect(
      readFileSync(".github/actions/start-sendmock-offline/action.yml", "utf8"),
    ).toContain("--provider-addr 127.0.0.1:8026");
    for (const exampleFolder of [
      "stripe-node",
      "paypal-node",
      "sslcommerz-node",
      "razorpay-node",
    ]) {
      expect(findExampleStep(exampleFolder)?.run).toContain(
        "node done-when.js",
      );
      expect(
        existsSync(`examples/payments/${exampleFolder}/done-when.js`),
      ).toBe(true);
    }
    expect(findExampleStep("stripe-php")?.run).toContain("php verify.php");
    expect(findExampleStep("stripe-python")?.run).toContain("python verify.py");
  });

  test("PY-01.3 SendMock runs as a user whose traffic beyond loopback is rejected, and no packet was", () => {
    const startAction = readFileSync(
      ".github/actions/start-sendmock-offline/action.yml",
      "utf8",
    );
    const checkAction = readFileSync(
      ".github/actions/check-sendmock-offline/action.yml",
      "utf8",
    );
    const startIndex = steps.findIndex(
      (step) => step.uses === "./.github/actions/start-sendmock-offline",
    );
    const checkIndex = steps.findIndex(
      (step) => step.uses === "./.github/actions/check-sendmock-offline",
    );

    expect(startAction).toContain("--uid-owner");
    expect(startAction).toContain("! -o lo -j REJECT");
    expect(startAction).toContain("ip6tables");
    expect(startAction).toContain('sudo -u "$OFFLINE_USER"');
    expect(checkAction).toContain("rejected_packets");
    expect(startIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeGreaterThan(
      steps.indexOf(findExampleStep("razorpay-node") ?? {}),
    );
  });

  test("Release build runs the payment apps before it publishes", () => {
    const releaseWorkflow = readFileSync(
      ".github/workflows/release.yml",
      "utf8",
    );

    expect(releaseWorkflow).toContain(
      "uses: ./.github/workflows/payment-apps.yml",
    );
  });
});
