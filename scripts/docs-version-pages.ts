/**
 * The pages a built docs version has, so the other versions can tell which of
 * their pages also exist at the site root (website/lib/seo/page-indexing.ts).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every folder with an index.html, as a page path ("/", "/docs/install").
 * `skippedFolders` are top-level folders that are not the version's own pages:
 * the demo app and the other versions copied inside the root.
 */
export function listBuiltPagePaths(
  siteDirectory: string,
  skippedFolders: Set<string>,
): string[] {
  const pagePaths: string[] = [];

  function collectPagePaths(folderPath: string, pagePath: string) {
    if (existsSync(join(folderPath, "index.html"))) {
      pagePaths.push(pagePath === "" ? "/" : pagePath);
    }
    for (const entryName of readdirSync(folderPath)) {
      const entryPath = join(folderPath, entryName);
      const isSkipped = pagePath === "" && skippedFolders.has(entryName);
      if (!isSkipped && statSync(entryPath).isDirectory()) {
        collectPagePaths(entryPath, `${pagePath}/${entryName}`);
      }
    }
  }

  collectPagePaths(siteDirectory, "");
  return pagePaths.sort();
}
