import type { MetadataRoute } from "next";

import { loadApiReference, toTagSlug } from "@/lib/openapi/load-openapi";
import {
  listAreas,
  loadCliReference,
  loadMcpReference,
} from "@/lib/reference/load-references";
import { listSitemapPagePaths } from "@/lib/seo/sitemap-pages";
import { buildSiteUrl } from "@/lib/seo/site-url";
import { source } from "@/lib/source";

export const dynamic = "force-static";

/**
 * Served at https://shibbir.me/sendmock/sitemap.xml; the domain's robots.txt
 * (the portfolio's) points here. scripts/build-docs-versions.ts removes the
 * copies the other docs versions build.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const mcpReference = loadMcpReference();
  const pagePaths = listSitemapPagePaths({
    docsPagePaths: source.getPages().map((docsPage) => docsPage.url),
    apiTagSlugs: loadApiReference().tagNames.map(toTagSlug),
    cliAreaSlugs: listAreas(loadCliReference().commands).map(
      (area) => area.slug,
    ),
    mcpAreaSlugs: listAreas([
      ...mcpReference.tools,
      ...mcpReference.resources,
    ]).map((area) => area.slug),
  });

  return pagePaths.map((pagePath) => ({ url: buildSiteUrl(pagePath) }));
}
