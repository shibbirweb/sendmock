import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

const repositoryDirectory = join(import.meta.dir, "../../..");

type Workflow = {
  jobs: Record<string, { container?: { image?: string } }>;
};

/** The workflows that run in Playwright's image, with the package whose version it must match. */
const imageUsers = [
  {
    workflowFile: "ci.yml",
    jobName: "web-e2e",
    packageFile: "web/package.json",
  },
  {
    workflowFile: "website.yml",
    jobName: "build",
    packageFile: "website/package.json",
  },
];

function readImageVersion(
  workflowFile: string,
  jobName: string,
): string | undefined {
  const workflow = parse(
    readFileSync(
      join(repositoryDirectory, ".github/workflows", workflowFile),
      "utf8",
    ),
  ) as Workflow;

  return /playwright:v([\d.]+)-/.exec(
    workflow.jobs[jobName]?.container?.image ?? "",
  )?.[1];
}

test("each Playwright image's version equals the @playwright/test it runs", () => {
  for (const imageUser of imageUsers) {
    const packageJson = JSON.parse(
      readFileSync(join(repositoryDirectory, imageUser.packageFile), "utf8"),
    ) as { devDependencies?: Record<string, string> };

    // The image's browser matches only its own Playwright version, so a range
    // in package.json could move the tests ahead of the image.
    expect(
      packageJson.devDependencies?.["@playwright/test"],
      imageUser.workflowFile,
    ).toBe(readImageVersion(imageUser.workflowFile, imageUser.jobName));
  }
});
