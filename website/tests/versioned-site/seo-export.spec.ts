import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { resolveDocsVersions } from "../../lib/docs-versions";

// Reads the export `bun scripts/build-docs-versions.ts` wrote to out/, every
// page of every docs version, as search engines get it.
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
const siteUrl = `https://shibbir.me${pagesBasePath}/`;
const outputDirectory = fileURLToPath(new URL("../../out", import.meta.url));
const gitTagNames = execFileSync("git", ["tag", "--list"], { encoding: "utf8" })
  .split("\n")
  .filter((tagName) => tagName.trim() !== "");
const versionFolders = resolveDocsVersions(gitTagNames)
  .filter((docsVersion) => docsVersion.path !== "")
  .map((docsVersion) => docsVersion.path.slice(1));
/** Folders that are not pages of the site root: the demo, Next's files and the 404 copies. */
const nonPageFolders = new Set(["demo", "_next", "_not-found", "404"]);

type HtmlTag = Record<string, string>;

/** Every page folder (with an index.html) under a folder, as paths like "docs/install". */
function listPageFolders(siteFolder: string, skippedFolders: Set<string>) {
  const pageFolders: string[] = [];
  function collectPageFolders(folderPath: string) {
    if (existsSync(join(folderPath, "index.html"))) {
      pageFolders.push(relative(siteFolder, folderPath));
    }
    for (const entryName of readdirSync(folderPath)) {
      const entryPath = join(folderPath, entryName);
      const isSkipped =
        folderPath === siteFolder && skippedFolders.has(entryName);
      if (!isSkipped && statSync(entryPath).isDirectory()) {
        collectPageFolders(entryPath);
      }
    }
  }
  collectPageFolders(siteFolder);
  return pageFolders.sort();
}

function readPageHtml(siteFolder: string, pageFolder: string): string {
  return readFileSync(join(siteFolder, pageFolder, "index.html"), "utf8");
}

function readHeadTags(pageHtml: string, tagName: "meta" | "link"): HtmlTag[] {
  const headHtml = pageHtml.split("</head>")[0] ?? "";
  return [...headHtml.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "g"))].map(
    ([tagHtml]) =>
      Object.fromEntries(
        [...tagHtml.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map(
          ([, attributeName, attributeValue]) => [
            attributeName,
            attributeValue,
          ],
        ),
      ),
  );
}

function findCanonicalUrl(pageHtml: string): string | undefined {
  return readHeadTags(pageHtml, "link").find(
    (linkTag) => linkTag.rel === "canonical",
  )?.href;
}

function findMetaContent(
  pageHtml: string,
  metaKey: string,
): string | undefined {
  return readHeadTags(pageHtml, "meta").find(
    (metaTag) => metaTag.name === metaKey || metaTag.property === metaKey,
  )?.content;
}

function readStructuredData(pageHtml: string): unknown[] {
  return [
    ...pageHtml.matchAll(
      /<script type="application\/ld\+json">(.*?)<\/script>/gs,
    ),
  ].map(([, jsonText]) => JSON.parse(jsonText ?? "") as unknown);
}

function listGraphTypes(structuredData: unknown[]): string[] {
  return structuredData.flatMap((structuredDataBlock) =>
    (
      (structuredDataBlock as { "@graph"?: { "@type": string | string[] }[] })[
        "@graph"
      ] ?? []
    ).flatMap((graphNode) => graphNode["@type"]),
  );
}

function toSiteUrl(pageFolder: string): string {
  return pageFolder === "" ? siteUrl : `${siteUrl}${pageFolder}/`;
}

/** "https://shibbir.me/sendmock/docs/install/" is the root page folder "docs/install". */
function toRootPageFolder(pageUrl: string): string {
  return pageUrl.slice(siteUrl.length).replace(/\/$/, "");
}

const rootPageFolders = listPageFolders(
  outputDirectory,
  new Set([...nonPageFolders, ...versionFolders]),
);

test("WS-13.1 every page of the site root names itself canonical, absolute and ending in a slash, with a title and description", () => {
  expect(rootPageFolders.length).toBeGreaterThan(100);
  for (const pageFolder of rootPageFolders) {
    const pageHtml = readPageHtml(outputDirectory, pageFolder);
    expect(findCanonicalUrl(pageHtml), pageFolder).toBe(toSiteUrl(pageFolder));
    expect(pageHtml, pageFolder).toMatch(/<title>[^<]+<\/title>/);
    expect(findMetaContent(pageHtml, "description"), pageFolder).toBeTruthy();
    expect(findMetaContent(pageHtml, "robots"), pageFolder).toBeUndefined();
  }
});

test("WS-13.2 /next/ and the older versions name the root's page canonical, or are noindex when it has none", () => {
  expect(versionFolders).toContain("next");
  for (const versionFolder of versionFolders) {
    const versionDirectory = join(outputDirectory, versionFolder);
    expect(
      existsSync(join(versionDirectory, "sitemap.xml")),
      versionFolder,
    ).toBe(false);
    for (const pageFolder of listPageFolders(
      versionDirectory,
      nonPageFolders,
    )) {
      const pageName = `${versionFolder}/${pageFolder}`;
      const pageHtml = readPageHtml(versionDirectory, pageFolder);
      const canonicalUrl = findCanonicalUrl(pageHtml);
      if (canonicalUrl === undefined) {
        expect(findMetaContent(pageHtml, "robots"), pageName).toBe(
          "noindex, follow",
        );
        expect(rootPageFolders, pageName).not.toContain(pageFolder);
      } else {
        expect(canonicalUrl, pageName).toBe(toSiteUrl(pageFolder));
        expect(rootPageFolders, pageName).toContain(pageFolder);
      }
    }
  }
});

test("WS-13.3 sitemap.xml lists every current page except the playground, each one served", () => {
  const sitemapXml = readFileSync(join(outputDirectory, "sitemap.xml"), "utf8");
  const listedUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, pageUrl]) => pageUrl ?? "",
  );

  for (const listedUrl of listedUrls) {
    expect(listedUrl.startsWith(siteUrl), listedUrl).toBe(true);
    expect(listedUrl.endsWith("/"), listedUrl).toBe(true);
    expect(
      existsSync(
        join(outputDirectory, toRootPageFolder(listedUrl), "index.html"),
      ),
      listedUrl,
    ).toBe(true);
  }
  expect(listedUrls.map(toRootPageFolder).sort()).toEqual(
    rootPageFolders.filter((pageFolder) => pageFolder !== "playground"),
  );
});

test("WS-13.3 the sitemap is served at the site root as XML", async ({
  request,
}) => {
  const sitemapResponse = await request.get(`${pagesBasePath}/sitemap.xml`);
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemapResponse.headers()["content-type"]).toContain("xml");
  expect(await sitemapResponse.text()).toContain(`<loc>${siteUrl}</loc>`);
});

test("WS-13.9 every sitemap entry has the date of the last commit that changed its page", () => {
  const sitemapXml = readFileSync(join(outputDirectory, "sitemap.xml"), "utf8");
  const sitemapEntries = [
    ...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g),
  ].map(([, entryXml]) => ({
    pageUrl: /<loc>([^<]+)<\/loc>/.exec(entryXml ?? "")?.[1] ?? "",
    lastModified: /<lastmod>([^<]+)<\/lastmod>/.exec(entryXml ?? "")?.[1],
  }));
  const rootVersion = resolveDocsVersions(gitTagNames).find(
    (docsVersion) => docsVersion.path === "",
  );
  const installPageDate = execFileSync(
    "git",
    [
      "log",
      "-1",
      "--format=%cI",
      rootVersion?.gitRef ?? "HEAD",
      "--",
      "docs/wiki/install.md",
    ],
    { cwd: join(outputDirectory, "../.."), encoding: "utf8" },
  ).trim();

  for (const sitemapEntry of sitemapEntries) {
    expect(sitemapEntry.lastModified, sitemapEntry.pageUrl).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/,
    );
    expect(
      Date.parse(sitemapEntry.lastModified ?? ""),
      sitemapEntry.pageUrl,
    ).toBeLessThanOrEqual(Date.now());
  }
  expect(
    sitemapEntries.find(
      (sitemapEntry) => sitemapEntry.pageUrl === `${siteUrl}docs/install/`,
    )?.lastModified,
  ).toBe(installPageDate);
  expect(
    new Set(sitemapEntries.map((sitemapEntry) => sitemapEntry.lastModified))
      .size,
    "pages are dated by their own files, not all by the build",
  ).toBeGreaterThan(1);
});

test("WS-13.4 every page has Open Graph and large Twitter card tags with absolute image URLs", () => {
  for (const pageFolder of rootPageFolders) {
    const pageHtml = readPageHtml(outputDirectory, pageFolder);
    expect(findMetaContent(pageHtml, "og:site_name"), pageFolder).toBe(
      "SendMock",
    );
    expect(findMetaContent(pageHtml, "og:type"), pageFolder).toBe("website");
    expect(findMetaContent(pageHtml, "og:url"), pageFolder).toBe(
      toSiteUrl(pageFolder),
    );
    expect(findMetaContent(pageHtml, "og:title"), pageFolder).toBeTruthy();
    expect(
      findMetaContent(pageHtml, "og:description"),
      pageFolder,
    ).toBeTruthy();
    expect(findMetaContent(pageHtml, "twitter:card"), pageFolder).toBe(
      "summary_large_image",
    );
    const imageUrl = findMetaContent(pageHtml, "og:image") ?? "";
    expect(imageUrl, pageFolder).toMatch(
      new RegExp(`^${siteUrl}social/sendmock(-docs)?\\.png$`),
    );
    expect(findMetaContent(pageHtml, "twitter:image"), pageFolder).toBe(
      imageUrl,
    );
    expect(
      existsSync(join(outputDirectory, imageUrl.slice(siteUrl.length))),
      imageUrl,
    ).toBe(true);
  }
});

test("WS-13.5 WS-13.6 the landing, docs and reference pages carry JSON-LD that parses", () => {
  const landingData = readStructuredData(readPageHtml(outputDirectory, ""));
  expect(listGraphTypes(landingData)).toEqual([
    "WebSite",
    "SoftwareApplication",
    "SoftwareSourceCode",
  ]);
  expect(JSON.stringify(landingData)).toContain(
    '"@id":"https://shibbir.me#person"',
  );

  const docsPageFolders = rootPageFolders.filter((pageFolder) =>
    pageFolder.startsWith("docs"),
  );
  expect(docsPageFolders.length).toBeGreaterThan(50);
  for (const pageFolder of docsPageFolders) {
    expect(
      listGraphTypes(
        readStructuredData(readPageHtml(outputDirectory, pageFolder)),
      ),
      pageFolder,
    ).toEqual(["TechArticle", "BreadcrumbList"]);
  }
  for (const pageFolder of rootPageFolders.filter((folder) =>
    /^(api|cli|mcp)\/[^/]+$/.test(folder),
  )) {
    expect(
      listGraphTypes(
        readStructuredData(readPageHtml(outputDirectory, pageFolder)),
      ),
      pageFolder,
    ).toEqual(["WebPage", "BreadcrumbList"]);
  }
});

test("WS-13.7 the demo and the 404 page are noindex; every page has one h1 and alt text on its images", () => {
  expect(findMetaContent(readPageHtml(outputDirectory, "demo"), "robots")).toBe(
    "noindex",
  );
  expect(
    findMetaContent(
      readFileSync(join(outputDirectory, "404.html"), "utf8"),
      "robots",
    ),
  ).toContain("noindex");

  for (const pageFolder of rootPageFolders) {
    const pageHtml = readPageHtml(outputDirectory, pageFolder);
    expect(pageHtml.match(/<h1[\s>]/g)?.length, pageFolder).toBe(1);
    for (const [imageTag] of pageHtml.matchAll(/<img\b[^>]*>/g)) {
      expect(imageTag, pageFolder).toMatch(/\salt="/);
    }
  }
});
