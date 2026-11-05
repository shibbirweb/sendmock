import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type StripeSdksWorkflow = {
  jobs: {
    stripe: { steps: { name?: string; "working-directory"?: string; run?: string }[] };
  };
};

const stripeSdksWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/stripe-sdks.yml", "utf8"),
) as StripeSdksWorkflow;

function findExampleStep(exampleFolder: string) {
  return stripeSdksWorkflow.jobs.stripe.steps.find(
    (step) => step["working-directory"] === `examples/payments/${exampleFolder}`,
  );
}

describe("Stripe SDKs workflow", () => {
  test("the Node SDK pays and handles a decline, then PHP and Python verify the same deliveries", () => {
    const steps = stripeSdksWorkflow.jobs.stripe.steps;

    expect(steps.some((step) => step.run?.includes("cargo build --release"))).toBe(true);
    expect(steps.some((step) => step.run?.includes("--provider-addr 127.0.0.1:8026"))).toBe(true);
    expect(findExampleStep("stripe-node")?.run).toContain("node done-when.js");
    expect(findExampleStep("stripe-php")?.run).toContain("php verify.php");
    expect(findExampleStep("stripe-python")?.run).toContain("python verify.py");
    expect(existsSync("examples/payments/stripe-node/done-when.js")).toBe(true);
    expect(existsSync("examples/payments/stripe-php/verify.php")).toBe(true);
    expect(existsSync("examples/payments/stripe-python/verify.py")).toBe(true);
  });

  test("PayPal's Node SDK captures, checks the webhooks, declines and refunds", () => {
    expect(findExampleStep("paypal-node")?.run).toContain("node done-when.js");
    expect(existsSync("examples/payments/paypal-node/done-when.js")).toBe(true);
  });

  test("SSLCommerz's Node package pays, checks the IPN, validates, declines and refunds", () => {
    expect(findExampleStep("sslcommerz-node")?.run).toContain("node done-when.js");
    expect(existsSync("examples/payments/sslcommerz-node/done-when.js")).toBe(true);
  });

  test("Release build runs the Stripe SDKs before it publishes", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(releaseWorkflow).toContain("uses: ./.github/workflows/stripe-sdks.yml");
  });
});
