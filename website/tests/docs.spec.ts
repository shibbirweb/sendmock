import { readdirSync, statSync } from "node:fs";
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
