import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const dockerPage = readFileSync("docs/wiki/connect/docker.md", "utf8");

function readYamlBlockAfter(introduction: string): string {
  const introductionIndex = dockerPage.indexOf(introduction);
  expect(introductionIndex).toBeGreaterThan(-1);
  const blockMatch = /```yaml\n([\s\S]*?)```/.exec(
    dockerPage.slice(introductionIndex),
  );
  return blockMatch?.[1] ?? "";
}

describe("Docker examples", () => {
  test("DS-02.6 the Docker page's whole compose.yaml is the one the workflow runs", () => {
    expect(
      readYamlBlockAfter("The whole `compose.yaml` then looks like this:"),
    ).toBe(readFileSync("examples/docker/compose.yaml", "utf8"));
  });

  test("DS-02.6 the workflow's service container is the one the Docker page shows", () => {
    const workflow = Bun.YAML.parse(
      readFileSync(".github/workflows/docker-examples.yml", "utf8"),
    ) as {
      jobs: {
        "service-container": {
          services: { sendmock: { ports: string[] } };
        };
      };
    };
    const pageServiceBlock = readYamlBlockAfter(
      "Add SendMock as a service container",
    );

    expect(pageServiceBlock).toContain("image: ghcr.io/shibbirweb/sendmock");
    expect(workflow.jobs["service-container"].services.sendmock.ports).toEqual([
      "1025:1025",
      "8025:8025",
    ]);
    for (const portMapping of ["- 1025:1025", "- 8025:8025"]) {
      expect(pageServiceBlock).toContain(portMapping);
    }
  });
});
