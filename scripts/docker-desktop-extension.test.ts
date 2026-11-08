import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const extensionFolder = "packaging/docker-desktop";
const dockerfileText = readFileSync(`${extensionFolder}/Dockerfile`, "utf8");
const metadata = JSON.parse(
  readFileSync(`${extensionFolder}/metadata.json`, "utf8"),
) as {
  icon: string;
  vm: { composefile: string };
  ui: { "dashboard-tab": { title: string; root: string; src: string } };
};
const composeText = readFileSync(`${extensionFolder}/docker-compose.yaml`, "utf8");
const dashboardPage = readFileSync(`${extensionFolder}/ui/index.html`, "utf8");
const releaseJobs = (
  Bun.YAML.parse(readFileSync(".github/workflows/release.yml", "utf8")) as {
    jobs: Record<string, { if?: string; needs?: string[] }>;
  }
).jobs;
const releaseWorkflowText = readFileSync(".github/workflows/release.yml", "utf8");

/** The labels Docker Desktop requires before it lists an extension. */
const requiredLabels = [
  "org.opencontainers.image.title",
  "org.opencontainers.image.description",
  "org.opencontainers.image.vendor",
  "com.docker.desktop.extension.api.version",
  "com.docker.desktop.extension.icon",
  "com.docker.extension.screenshots",
  "com.docker.extension.detailed-description",
  "com.docker.extension.publisher-url",
  "com.docker.extension.changelog",
];

describe("Docker Desktop extension", () => {
  test("DS-10.1 the image has every required label and metadata naming its files, and runs SendMock with its ports", () => {
    for (const label of requiredLabels) {
      expect(dockerfileText).toContain(`${label}=`);
    }
    expect(existsSync(`${extensionFolder}/${metadata.icon}`)).toBe(true);
    expect(existsSync(`${extensionFolder}/${metadata.vm.composefile}`)).toBe(true);
    expect(composeText).toContain("image: ghcr.io/shibbirweb/sendmock");
    expect(composeText).toContain('"1025:1025"');
    expect(composeText).toContain('"8025:8025"');
  });

  test("DS-10.2 the dashboard tab shows whether SendMock answers and opens the web UI", () => {
    expect(metadata.ui["dashboard-tab"].src).toBe("index.html");
    expect(dashboardPage).toContain("/api/v1/health");
    expect(dashboardPage).toContain("ddClient.host.openExternal(sendmockUrl)");
    expect(dashboardPage).toContain('role="status"');
  });

  test("DS-10.3 CI builds the image for both platforms and checks its labels and metadata", () => {
    const workflowText = readFileSync(
      ".github/workflows/docker-desktop-extension.yml",
      "utf8",
    );

    expect(workflowText).toContain("platforms: linux/amd64,linux/arm64");
    for (const label of requiredLabels) {
      expect(workflowText).toContain(label);
    }
    expect(workflowText).toContain("metadata.json");
  });

  test("DS-10.4 the docs say how to install the extension", () => {
    const installPage = readFileSync("docs/wiki/install.md", "utf8");
    const extensionSection = installPage.slice(
      installPage.indexOf("## Docker Desktop extension"),
    );

    expect(extensionSection).toContain("docker build -t sendmock-docker-extension:0.0.1 packaging/docker-desktop");
    expect(extensionSection).toContain("docker extension install sendmock-docker-extension:0.0.1");
    expect(extensionSection).toContain("docker extension install ghcr.io/shibbirweb/sendmock-docker-extension:");
  });

  test("DS-10.5 each beta and stable release pushes the image for both platforms, its backend pinned to the version", () => {
    expect(releaseJobs["docker-extension"]?.if).toBe(
      "inputs.publish && (inputs.channel == 'beta' || inputs.channel == 'stable')",
    );
    expect(releaseJobs["docker-extension"]?.needs).toEqual(["plan", "docker"]);
    expect(composeText).toMatch(/image: ghcr\.io\/shibbirweb\/sendmock$/m);
    expect(releaseWorkflowText).toContain(
      "image: ghcr.io/shibbirweb/sendmock:$VERSION",
    );
    expect(releaseWorkflowText).toContain("EXTENSION_IMAGE: ghcr.io/shibbirweb/sendmock-docker-extension");
    expect(releaseWorkflowText).toContain('test "$platforms" = "linux/amd64 linux/arm64"');
    expect(releaseWorkflowText).toContain("docker logout ghcr.io");
  });
});
