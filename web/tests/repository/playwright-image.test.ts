import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

const repositoryDirectory = join(import.meta.dir, "../../..");

type Workflow = {
  jobs: Record<string, { container?: { image?: string } }>;
};

test("the end-to-end image's Playwright version equals @playwright/test", () => {
  const ciWorkflow = parse(
    readFileSync(join(repositoryDirectory, ".github/workflows/ci.yml"), "utf8"),
  ) as Workflow;
  const webPackage = JSON.parse(
    readFileSync(join(repositoryDirectory, "web/package.json"), "utf8"),
  ) as { devDependencies?: Record<string, string> };
  const imageVersion = /playwright:v([\d.]+)-/.exec(
    ciWorkflow.jobs["web-e2e"]?.container?.image ?? "",
  )?.[1];

  // The image's browser matches only its own Playwright version, so a range
  // in package.json could move the tests ahead of the image.
  expect(webPackage.devDependencies?.["@playwright/test"]).toBe(imageVersion);
});
