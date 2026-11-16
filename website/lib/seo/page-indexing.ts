import { existsSync, readFileSync } from "node:fs";

/**
 * How search engines should treat a page of this build. The site root's build
 * is the one to index. /next/ and the older versions repeat its pages, so a
 * page that also exists at the root names that page as canonical, and a page
 * that exists only in this version is kept out of search but its links are
 * still followed.
 */
export type PageIndexing = "canonical" | "noindex";

/** "docs/install/" and "/docs/install" both become "/docs/install"; the root is "/". */
export function normalizePagePath(pagePath: string): string {
  const trimmedPath = pagePath.replace(/^\/+|\/+$/g, "");
  return trimmedPath === "" ? "/" : `/${trimmedPath}`;
}

/**
 * The root build's pages, which scripts/build-docs-versions.ts writes before
 * it builds the other versions; null when this build is the root (or a plain
 * build), whose pages are all canonical.
 */
export function readRootPagePaths(
  rootPagePathsFile: string | undefined,
): Set<string> | null {
  if (rootPagePathsFile === undefined || rootPagePathsFile === "") {
    return null;
  }
  if (!existsSync(rootPagePathsFile)) {
    throw new Error(`The root page list ${rootPagePathsFile} does not exist.`);
  }
  const pagePaths: unknown = JSON.parse(
    readFileSync(rootPagePathsFile, "utf8"),
  );
  if (!Array.isArray(pagePaths)) {
    throw new Error(`The root page list ${rootPagePathsFile} is not a list.`);
  }
  return new Set(
    pagePaths.map((pagePath) => normalizePagePath(String(pagePath))),
  );
}

export function resolvePageIndexing(
  pagePath: string,
  rootPagePaths: Set<string> | null,
): PageIndexing {
  if (rootPagePaths === null) {
    return "canonical";
  }
  return rootPagePaths.has(normalizePagePath(pagePath))
    ? "canonical"
    : "noindex";
}

export const rootPagePaths = readRootPagePaths(
  process.env.DOCS_ROOT_PAGE_PATHS_FILE,
);
