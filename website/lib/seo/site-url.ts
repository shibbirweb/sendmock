import { basePath } from "@/lib/base-path";
import {
  type DocsVersionLink,
  docsVersionLinks,
} from "@/lib/current-docs-version";

/**
 * The domain the site is served from: the user site shibbirweb.github.io owns
 * the custom domain, so shibbirweb.github.io/sendmock/ redirects here.
 */
export const siteOrigin = "https://shibbir.me";

/** The version served at the site root: the newest stable, or the Preview before one exists. */
export function findRootVersionLink(
  versionLinks: DocsVersionLink[],
): DocsVersionLink | undefined {
  return versionLinks.find(
    (versionLink) =>
      versionLink.kind === "stable" || versionLink.kind === "preview",
  );
}

/**
 * The root version's path under the domain without its trailing slash
 * ("/sendmock"), so every docs version links to the current site.
 */
export function resolveSiteRootPath(
  versionLinks: DocsVersionLink[],
  fallbackBasePath: string,
): string {
  const rootVersionHref = findRootVersionLink(versionLinks)?.href;
  if (rootVersionHref === undefined) {
    return fallbackBasePath.replace(/\/$/, "");
  }
  return rootVersionHref.replace(/\/$/, "");
}

/** A loop, not a regular expression: `\/+$` backtracks on a long run of slashes. */
function trimSlashes(pathText: string): string {
  let startIndex = 0;
  let endIndex = pathText.length;
  while (startIndex < endIndex && pathText[startIndex] === "/") {
    startIndex += 1;
  }
  while (endIndex > startIndex && pathText[endIndex - 1] === "/") {
    endIndex -= 1;
  }
  return pathText.slice(startIndex, endIndex);
}

/** A page's absolute address, always ending in "/" as GitHub Pages serves it. */
export function buildAbsolutePageUrl(
  origin: string,
  rootPath: string,
  pagePath: string,
): string {
  const trimmedPagePath = trimSlashes(pagePath);
  const pageSuffix = trimmedPagePath === "" ? "" : `${trimmedPagePath}/`;
  return `${origin}${rootPath}/${pageSuffix}`;
}

/** A file's absolute address (an image, the sitemap), without a trailing slash. */
export function buildAbsoluteFileUrl(
  origin: string,
  rootPath: string,
  filePath: string,
): string {
  return `${origin}${rootPath}/${trimSlashes(filePath)}`;
}

export const siteRootPath = resolveSiteRootPath(docsVersionLinks, basePath);

/** https://shibbir.me/sendmock/ in the published site. */
export const siteUrl = buildAbsolutePageUrl(siteOrigin, siteRootPath, "/");

export function buildSiteUrl(pagePath: string): string {
  return buildAbsolutePageUrl(siteOrigin, siteRootPath, pagePath);
}

export function buildSiteFileUrl(filePath: string): string {
  return buildAbsoluteFileUrl(siteOrigin, siteRootPath, filePath);
}

/** A page of the docs version being built, such as /sendmock/v1.0/docs/. */
export function buildVersionPageUrl(pagePath: string): string {
  return buildAbsolutePageUrl(
    siteOrigin,
    basePath.replace(/\/$/, ""),
    pagePath,
  );
}

/** A file of the docs version being built, such as its own llms.txt. */
export function buildVersionFileUrl(filePath: string): string {
  return buildAbsoluteFileUrl(
    siteOrigin,
    basePath.replace(/\/$/, ""),
    filePath,
  );
}
