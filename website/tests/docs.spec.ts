import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const wikiDirectory = fileURLToPath(
  new URL("../../docs/wiki", import.meta.url),
);

/** `/docs/connect/php/` for docs/wiki/connect/php.md; index pages map to their folder. */
function listWikiPagePaths(directoryPath = wikiDirectory): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);
    if (statSync(entryPath).isDirectory()) {
      return entryName === "images" ? [] : listWikiPagePaths(entryPath);
    }
    if (!entryName.endsWith(".md")) {
      return [];
    }
    const slug = relative(wikiDirectory, entryPath)
      .replace(/\.md$/, "")
      .replace(/(^|\/)index$/, "");

    return [`/docs/${slug}${slug === "" ? "" : "/"}`];
  });
}

test("every page in docs/wiki is published under /docs/", async ({
  request,
}) => {
  const wikiPagePaths = listWikiPagePaths();
  expect(wikiPagePaths.length).toBeGreaterThan(20);

  for (const wikiPagePath of wikiPagePaths) {
    const pageResponse = await request.get(wikiPagePath);
    expect(pageResponse.status(), wikiPagePath).toBe(200);
  }
});

test("every copy of the logo on a docs page has its own gradient, so the sidebar logo is not blank", async ({
  page,
}) => {
  await page.goto("/docs/install/");
  const gradientIds = await page
    .locator('svg[viewBox="0 0 64 64"] linearGradient')
    .evaluateAll((gradients) => gradients.map((gradient) => gradient.id));

  // The docs render the nav title twice (mobile bar and sidebar).
  expect(gradientIds.length).toBeGreaterThan(1);
  expect(new Set(gradientIds).size).toBe(gradientIds.length);
});

test("the docs sidebar links to GitHub and the feature request, bug report and security report forms", async ({
  page,
}) => {
  await page.goto("/docs/install/");
  const repositoryUrl = "https://github.com/shibbirweb/sendmock";
  const feedbackLinks = [
    { name: "Star SendMock on GitHub", url: repositoryUrl },
    {
      name: "Request a feature",
      url: `${repositoryUrl}/issues/new?template=feature_request.yml`,
    },
    {
      name: "Report a bug",
      url: `${repositoryUrl}/issues/new?template=bug_report.yml`,
    },
    {
      name: "Report a security issue",
      url: `${repositoryUrl}/security/advisories/new`,
    },
  ];

  for (const feedbackLink of feedbackLinks) {
    await expect(
      page
        .getByRole("link", { name: feedbackLink.name, exact: true })
        .filter({ visible: true }),
    ).toHaveAttribute("href", feedbackLink.url);
  }
});

test("Getting started installs on macOS, Linux, Windows and Docker with the Install page's commands and links to it", async ({
  page,
}) => {
  const installPage = readFileSync(join(wikiDirectory, "install.md"), "utf8");
  const gettingStartedPage = readFileSync(
    join(wikiDirectory, "getting-started.md"),
    "utf8",
  );
  const tabCommands = [
    ...gettingStartedPage.matchAll(/```\w+ tab="([^"]+)"[^\n]*\n\s*(.+)\n/g),
  ].map((tabMatch) => [tabMatch[1] ?? "", (tabMatch[2] ?? "").trim()]);

  expect(tabCommands.map(([tabName]) => tabName)).toEqual([
    "macOS",
    "Linux",
    "Windows",
    "Docker",
  ]);
  for (const [tabName, command] of tabCommands) {
    expect(installPage, `the ${tabName} command is on Install`).toContain(
      command,
    );
  }

  await page.goto("/docs/getting-started/");
  for (const [tabName, command] of tabCommands) {
    await page.getByRole("tab", { name: tabName, exact: true }).click();
    await expect(
      page.getByRole("tabpanel").filter({ visible: true }),
    ).toContainText(command);
  }
  for (const [linkName, installAnchor] of [
    ["macOS", "#homebrew-macos-and-linux"],
    ["Linux", "#install-script-linux-and-macos"],
    ["Windows", "#install-script-windows"],
    ["Docker", "#docker"],
    ["Binaries", "#binaries"],
  ]) {
    await expect(
      page
        .getByRole("article")
        .getByRole("link", { name: linkName, exact: true }),
    ).toHaveAttribute("href", new RegExp(`/docs/install/${installAnchor}$`));
  }
});

test("hovering a docs sidebar icon shows its label", async ({ page }) => {
  await page.goto("/docs/install/");
  const bugReportLink = page
    .getByRole("link", { name: "Report a bug", exact: true })
    .filter({ visible: true });
  const tooltip = bugReportLink.getByText("Report a bug");

  await expect(tooltip).toHaveCSS("opacity", "0");
  await bugReportLink.hover();

  await expect(tooltip).toHaveCSS("opacity", "1");
});

test("WS-03.3 every internal link in the docs leads to a page and an existing anchor", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pagesToVisit = ["/docs/"];
  const visitedPaths = new Set<string>();
  const brokenLinks: string[] = [];

  while (pagesToVisit.length > 0) {
    const pagePath = pagesToVisit.shift() ?? "";
    if (visitedPaths.has(pagePath)) {
      continue;
    }
    visitedPaths.add(pagePath);
    const pageResponse = await page.goto(pagePath);
    if (pageResponse?.status() !== 200) {
      brokenLinks.push(`${pagePath} answered ${pageResponse?.status()}`);
      continue;
    }

    const linkTargets = await page
      .locator("main a[href], aside a[href]")
      .evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
      );
    for (const rawLinkTarget of linkTargets) {
      if (/^(https?:|mailto:|#)/.test(rawLinkTarget)) {
        continue;
      }
      // Relative links are resolved against the page; a `.md` link left over
      // means the Markdown pointed at a file that does not exist.
      const linkTarget = new URL(
        rawLinkTarget,
        `http://site${pagePath}`,
      ).href.replace("http://site", "");
      if (/\.md(#|$)/.test(linkTarget)) {
        brokenLinks.push(`${pagePath} links to a missing ${rawLinkTarget}`);
        continue;
      }
      // The demo is a separate app, added by the Pages build.
      if (linkTarget.startsWith("/demo")) {
        continue;
      }
      const [targetPath = "", targetAnchor] = linkTarget.split("#");
      const targetResponse = await page.request.get(targetPath);
      if (targetResponse.status() !== 200) {
        brokenLinks.push(
          `${pagePath} links to ${targetPath} (${targetResponse.status()})`,
        );
        continue;
      }
      if (targetAnchor !== undefined) {
        const anchorExists = await page.evaluate(
          async ({ path, anchor }) => {
            const html = await (await fetch(path)).text();
            return (
              new DOMParser()
                .parseFromString(html, "text/html")
                .getElementById(anchor) !== null
            );
          },
          { path: targetPath, anchor: targetAnchor },
        );
        if (!anchorExists) {
          brokenLinks.push(
            `${pagePath} links to a missing #${targetAnchor} on ${targetPath}`,
          );
        }
      }
      if (targetPath.startsWith("/docs") && !visitedPaths.has(targetPath)) {
        pagesToVisit.push(targetPath);
      }
    }
  }

  expect(brokenLinks).toEqual([]);
  expect(visitedPaths.size).toBeGreaterThan(20);
});
