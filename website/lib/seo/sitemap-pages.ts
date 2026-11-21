export type SitemapSources = {
  /** Every docs page: its path, such as "/docs/install", and its file under docs/wiki/, such as "install.md". */
  docsPages: { pagePath: string; wikiFilePath: string }[];
  apiTagSlugs: string[];
  cliAreaSlugs: string[];
  mcpAreaSlugs: string[];
};

/**
 * A page search engines are told about, with the repository files its
 * content comes from: their last commit is the page's last modified date.
 */
export type SitemapPage = {
  pagePath: string;
  sourcePaths: string[];
  /** True for website code, which every docs version builds from the current branch. */
  isWebsiteSource: boolean;
};

const landingSourcePaths = ["website/app/(home)", "website/components/landing"];
const changelogSourcePaths = ["CHANGELOG.md"];
const apiSourcePaths = ["docs/api/openapi.yaml"];
const cliSourcePaths = ["docs/api/cli-reference.json"];
const mcpSourcePaths = ["docs/api/mcp-tools.json"];

function buildContentPage(
  pagePath: string,
  sourcePaths: string[],
): SitemapPage {
  return { pagePath, sourcePaths, isWebsiteSource: false };
}

/**
 * The pages search engines are told about. The playground (a tool with
 * little text) and the demo (an app, marked noindex) are left out, and so are
 * /next/ and the older versions, which are copies of these pages.
 */
export function listSitemapPages(
  sitemapSources: SitemapSources,
): SitemapPage[] {
  const sitemapPages: SitemapPage[] = [
    { pagePath: "/", sourcePaths: landingSourcePaths, isWebsiteSource: true },
    ...sitemapSources.docsPages.map((docsPage) =>
      buildContentPage(docsPage.pagePath, [
        `docs/wiki/${docsPage.wikiFilePath}`,
      ]),
    ),
    buildContentPage("/docs/whats-new", changelogSourcePaths),
    buildContentPage("/docs/upgrade", changelogSourcePaths),
    buildContentPage("/api", apiSourcePaths),
    ...sitemapSources.apiTagSlugs.map((tagSlug) =>
      buildContentPage(`/api/${tagSlug}`, apiSourcePaths),
    ),
    buildContentPage("/cli", cliSourcePaths),
    ...sitemapSources.cliAreaSlugs.map((areaSlug) =>
      buildContentPage(`/cli/${areaSlug}`, cliSourcePaths),
    ),
    buildContentPage("/mcp", mcpSourcePaths),
    ...sitemapSources.mcpAreaSlugs.map((areaSlug) =>
      buildContentPage(`/mcp/${areaSlug}`, mcpSourcePaths),
    ),
    buildContentPage("/changelog", changelogSourcePaths),
  ];
  const pagesByPath = new Map<string, SitemapPage>();
  for (const sitemapPage of sitemapPages) {
    if (!pagesByPath.has(sitemapPage.pagePath)) {
      pagesByPath.set(sitemapPage.pagePath, sitemapPage);
    }
  }

  return [...pagesByPath.values()];
}
