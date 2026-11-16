export type SitemapSources = {
  /** Every docs page's path, such as "/docs/install". */
  docsPagePaths: string[];
  apiTagSlugs: string[];
  cliAreaSlugs: string[];
  mcpAreaSlugs: string[];
};

/**
 * The page paths search engines are told about. The playground (a tool with
 * little text) and the demo (an app, marked noindex) are left out, and so are
 * /next/ and the older versions, which are copies of these pages.
 */
export function listSitemapPagePaths(sitemapSources: SitemapSources): string[] {
  const pagePaths = [
    "/",
    ...sitemapSources.docsPagePaths,
    "/docs/whats-new",
    "/docs/upgrade",
    "/api",
    ...sitemapSources.apiTagSlugs.map((tagSlug) => `/api/${tagSlug}`),
    "/cli",
    ...sitemapSources.cliAreaSlugs.map((areaSlug) => `/cli/${areaSlug}`),
    "/mcp",
    ...sitemapSources.mcpAreaSlugs.map((areaSlug) => `/mcp/${areaSlug}`),
    "/changelog",
  ];

  return [...new Set(pagePaths)];
}
