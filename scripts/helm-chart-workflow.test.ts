import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chartFolder = "packaging/helm/sendmock";
const workflowText = readFileSync(".github/workflows/helm-chart.yml", "utf8");
const deploymentTemplate = readFileSync(`${chartFolder}/templates/deployment.yaml`, "utf8");
const serviceTemplate = readFileSync(`${chartFolder}/templates/service.yaml`, "utf8");
const valuesText = readFileSync(`${chartFolder}/values.yaml`, "utf8");
const releaseJobs = (
  Bun.YAML.parse(readFileSync(".github/workflows/release.yml", "utf8")) as {
    jobs: Record<string, { if?: string; needs?: string[] }>;
  }
).jobs;
const releaseWorkflowText = readFileSync(".github/workflows/release.yml", "utf8");

describe("Helm chart", () => {
  test("DS-09.1 the chart runs as the image's non-root user with health probes and SMTP and HTTP services", () => {
    expect(deploymentTemplate).toContain("runAsUser: 10001");
    expect(deploymentTemplate).toContain("readOnlyRootFilesystem: true");
    expect(deploymentTemplate.match(/path: \/api\/v1\/health/g)?.length).toBe(2);
    expect(serviceTemplate).toContain("name: smtp");
    expect(serviceTemplate).toContain("name: http");
    expect(serviceTemplate).toContain("{{- if .Values.providerPort.enabled }}");
  });

  test("DS-09.2 values set the image, resources, persistence, settings, provider port and Ingress", () => {
    for (const valueKey of ["image:", "resources:", "persistence:", "env:", "providerPort:", "ingress:"]) {
      expect(valuesText).toContain(valueKey);
    }
    expect(deploymentTemplate).toContain("persistentVolumeClaim:");
    expect(deploymentTemplate).toContain("emptyDir: {}");
  });

  test("DS-09.3 CI lints, renders with every option and installs on kind, then checks health and an email", () => {
    expect(workflowText).toContain('helm lint "$CHART" $EVERY_OPTION');
    expect(workflowText).toContain("uses: helm/kind-action@v1");
    expect(workflowText).toContain("--mail-rcpt sam@example.test");
    expect(workflowText).toContain("/api/v1/health");
  });

  test("DS-09.4 the docs say how to install the chart and change its values", () => {
    const dockerPage = readFileSync("docs/wiki/connect/kubernetes.md", "utf8");

    expect(dockerPage).toContain("helm install sendmock");
    expect(dockerPage).toContain("--set persistence.enabled=true");
  });

  test("DS-09.5 each beta and stable release pushes the chart to GHCR and installs it from there logged out", () => {
    expect(releaseJobs["helm-chart"]?.if).toBe(
      "inputs.publish && (inputs.channel == 'beta' || inputs.channel == 'stable')",
    );
    expect(releaseJobs["helm-chart"]?.needs).toEqual(["plan", "docker"]);
    expect(releaseWorkflowText).toContain("helm push \"chart-package/sendmock-$VERSION.tgz\" oci://ghcr.io/shibbirweb/charts");
    expect(releaseWorkflowText).toContain("helm registry logout ghcr.io");
    expect(releaseWorkflowText).toContain(
      "helm install sendmock oci://ghcr.io/shibbirweb/charts/sendmock --version \"$VERSION\"",
    );
    expect(releaseWorkflowText).toContain("'.version == $version'");
  });
});
