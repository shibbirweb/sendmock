import {
  buildBreadcrumbLinks,
  type BreadcrumbStep,
} from "@/lib/seo/breadcrumbs";
import { buildSiteUrl, siteUrl } from "@/lib/seo/site-url";
import { buildDocsStructuredData } from "@/lib/seo/structured-data";

export type DocsPageDescription = {
  title: string;
  description: string;
  pagePath: string;
  /** The steps between Docs and this page, this page included. */
  breadcrumbSteps: BreadcrumbStep[];
};

/** A docs page's TechArticle and breadcrumb trail, home and Docs first. */
export function buildDocsPageStructuredData(docsPage: DocsPageDescription) {
  return buildDocsStructuredData({
    siteUrl,
    pageUrl: buildSiteUrl(docsPage.pagePath),
    title: docsPage.title,
    description: docsPage.description,
    breadcrumbLinks: buildBreadcrumbLinks(
      [{ name: "Docs", pagePath: "/docs" }, ...docsPage.breadcrumbSteps],
      buildSiteUrl,
    ),
  });
}
