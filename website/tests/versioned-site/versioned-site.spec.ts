import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { resolveDocsVersions } from "../../lib/docs-versions";

// The expected versions come from the repository's tags through the same resolver the build
// uses, so the tests hold for every release instead of naming one.
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
const gitTagNames = execFileSync("git", ["tag", "--list"], { encoding: "utf8" })
  .split("\n")
  .filter((tagName) => tagName.trim() !== "");
const docsVersions = resolveDocsVersions(gitTagNames);
const stableDocsVersion = docsVersions.find(
  (docsVersion) => docsVersion.kind === "stable",
);
const pagePathsWithBanner = ["/", "/docs/", "/api/", "/cli/", "/playground/"];

function buildVersionUrl(versionPath: string, pagePath: string): string {
  return `${pagesBasePath}${versionPath}${pagePath}`;
}

test("WS-03.1 / serves the newest stable docs, /next/ develop and each older minor its own, with a working switcher", async ({
  page,
}) => {
  expect(docsVersions.map((docsVersion) => docsVersion.path)).toContain(
    "/next",
  );
  for (const docsVersion of docsVersions) {
    await page.goto(buildVersionUrl(docsVersion.path, "/docs/install/"));

    const versionButton = page.getByRole("button", {
      name: `Docs version: ${docsVersion.label}`,
    });
    await versionButton.click();
    await expect(page.getByRole("menuitem")).toHaveText(
      docsVersions.map((listedVersion) => listedVersion.label),
    );
    await expect(
      page.getByRole("menuitem", { name: docsVersion.label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    for (const listedVersion of docsVersions) {
      await expect(
        page.getByRole("menuitem", { name: listedVersion.label, exact: true }),
      ).toHaveAttribute(
        "href",
        buildVersionUrl(listedVersion.path, "/docs/install/"),
      );
    }
    await page.keyboard.press("Escape");

    if (docsVersion.kind === "stable") {
      await expect(page.getByTestId("docs-version-banner")).toHaveCount(0);
    } else {
      await expect(page.getByTestId("docs-version-banner")).toBeVisible();
    }
  }
});

test("WS-03.7 every page of a non-stable version shows its banner with a link to the stable docs", async ({
  page,
}) => {
  const nonStableVersions = docsVersions.filter(
    (docsVersion) => docsVersion.kind !== "stable",
  );
  expect(nonStableVersions.length).toBeGreaterThan(0);
  for (const docsVersion of nonStableVersions) {
    for (const pagePath of pagePathsWithBanner) {
      await page.goto(buildVersionUrl(docsVersion.path, pagePath));
      const versionBanner = page.getByTestId("docs-version-banner");
      await expect(versionBanner).toBeVisible();
      if (stableDocsVersion !== undefined) {
        await expect(
          versionBanner.getByRole("link", {
            name: `Read the ${stableDocsVersion.label} docs`,
          }),
        ).toHaveAttribute("href", buildVersionUrl("", "/docs/"));
      }
    }
  }
});

test("WS-03.7 the demo of each version links its guide pages to the docs of the same version", async ({
  page,
}) => {
  for (const docsVersion of docsVersions) {
    await page.goto(buildVersionUrl(docsVersion.path, "/demo/"));
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: "Read the Overview guide" }),
    ).toHaveAttribute(
      "href",
      buildVersionUrl(docsVersion.path, "/docs/overview/"),
    );
  }
});
