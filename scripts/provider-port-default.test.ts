import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const dockerfileText = readFileSync("Dockerfile", "utf8");
const helmDeploymentTemplate = readFileSync("packaging/helm/sendmock/templates/deployment.yaml", "utf8");

describe("Provider port defaults in the packages", () => {
  test("PL-24.1 the Docker images keep the provider port off unless SENDMOCK_PROVIDER_ADDR sets it", () => {
    expect(dockerfileText.match(/SENDMOCK_PROVIDER_ADDR=none/g)?.length).toBe(2);
  });

  test("PL-24.1 the Helm chart sets the provider port from providerPort.enabled, none when off", () => {
    expect(helmDeploymentTemplate).toContain(
      '            {{- if .Values.providerPort.enabled }}\n              value: "0.0.0.0:8026"\n            {{- else }}\n              value: "none"',
    );
  });
});
