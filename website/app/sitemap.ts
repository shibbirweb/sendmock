import { join } from "node:path";

import type { MetadataRoute } from "next";

import { loadApiReference, toTagSlug } from "@/lib/openapi/load-openapi";
import {
  listAreas,
  loadCliReference,
  loadMcpReference,
} from "@/lib/reference/load-references";
import { listSitemapPages } from "@/lib/seo/sitemap-pages";
import { buildSiteUrl } from "@/lib/seo/site-url";
import { findLastCommitDate } from "@/lib/seo/source-last-modified";
import { source } from "@/lib/source";

export const dynamic = "force-static";

/** The checkout being built: this repository, or a worktree of a released tag. */
const contentRepositoryRoot = join(process.cwd(), "..");
/**
 * A tag's worktree gets today's website code copied over it, so the landing
 * page's history is read from the current checkout that
 * scripts/build-docs-versions.ts names.
 */
const websiteRepositoryRoot =
  process.env.WEBSITE_GIT_ROOT ?? contentRepositoryRoot;

/**
 * Served at https://shibbir.me/sendmock/sitemap.xml; the domain's robots.txt
 * (the portfolio's) points here. scripts/build-docs-versions.ts removes the
 * copies the other docs versions build.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const mcpReference = loadMcpReference();
  const sitemapPages = listSitemapPages({
    docsPages: source.getPages().map((docsPage) => ({
      pagePath: docsPage.url,
      wikiFilePath: docsPage.path,
    })),
    apiTagSlugs: loadApiReference().tagNames.map(toTagSlug),
    cliAreaSlugs: listAreas(loadCliReference().commands).map(
      (area) => area.slug,
    ),
    mcpAreaSlugs: listAreas([
      ...mcpReference.tools,
      ...mcpReference.resources,
    ]).map((area) => area.slug),
  });

  return sitemapPages.map((sitemapPage) => ({
    url: buildSiteUrl(sitemapPage.pagePath),
    lastModified: findLastCommitDate(
      sitemapPage.sourcePaths,
      sitemapPage.isWebsiteSource
        ? websiteRepositoryRoot
        : contentRepositoryRoot,
    ),
  }));
}
