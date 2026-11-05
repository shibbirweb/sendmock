import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type WorkflowStep = { name?: string; "working-directory"?: string; run?: string };
type PaymentAppsWorkflow = {
  jobs: { apps: { steps: WorkflowStep[] } };
};

const paymentAppsWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/payment-apps.yml", "utf8"),
) as PaymentAppsWorkflow;
const steps = paymentAppsWorkflow.jobs.apps.steps;

function findExampleStep(exampleFolder: string) {
  return steps.find(
    (step) => step["working-directory"] === `examples/payments/${exampleFolder}`,
  );
}

function findStepIndex(stepName: string) {
  return steps.findIndex((step) => step.name === stepName);
}

describe("Payment apps workflow", () => {
  test("the Stripe, PayPal and SSLCommerz apps run against a release binary", () => {
    expect(steps.some((step) => step.run?.includes("cargo build --release"))).toBe(true);
    expect(steps.some((step) => step.run?.includes("--provider-addr 127.0.0.1:8026"))).toBe(true);
    for (const exampleFolder of ["stripe-node", "paypal-node", "sslcommerz-node"]) {
      expect(findExampleStep(exampleFolder)?.run).toContain("node done-when.js");
      expect(existsSync(`examples/payments/${exampleFolder}/done-when.js`)).toBe(true);
    }
    expect(findExampleStep("stripe-php")?.run).toContain("php verify.php");
    expect(findExampleStep("stripe-python")?.run).toContain("python verify.py");
  });

  test("PY-01.3 SendMock runs as a user whose traffic beyond loopback is rejected, and no packet was", () => {
    const firewallStep = steps[findStepIndex("A user whose traffic beyond this machine is rejected")];
    const startStep = steps[findStepIndex("Start SendMock offline with the provider port")];
    const checkIndex = findStepIndex("SendMock opened no connection beyond this machine");

    expect(firewallStep?.run).toContain("--uid-owner");
    expect(firewallStep?.run).toContain("! -o lo -j REJECT");
    expect(firewallStep?.run).toContain("ip6tables");
    expect(startStep?.run).toContain('sudo -u "$OFFLINE_USER"');
    expect(checkIndex).toBeGreaterThan(steps.indexOf(findExampleStep("sslcommerz-node") ?? {}));
    expect(steps[checkIndex]?.run).toContain("rejected_packets");
  });

  test("Release build runs the payment apps before it publishes", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(releaseWorkflow).toContain("uses: ./.github/workflows/payment-apps.yml");
  });
});
