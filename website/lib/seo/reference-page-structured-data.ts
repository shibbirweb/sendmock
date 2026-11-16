import { buildBreadcrumbLinks } from "@/lib/seo/breadcrumbs";
import { buildSiteUrl, siteUrl } from "@/lib/seo/site-url";
import { buildReferenceStructuredData } from "@/lib/seo/structured-data";

export type ReferencePageDescription = {
  /** The reference it belongs to, such as "CLI reference" at "/cli". */
  sectionName: string;
  sectionPath: string;
  title: string;
  description: string;
  pagePath: string;
};

/** JSON-LD for an API tag, CLI area or MCP area page. */
export function buildReferencePageStructuredData(
  referencePage: ReferencePageDescription,
) {
  return buildReferenceStructuredData({
    siteUrl,
    pageUrl: buildSiteUrl(referencePage.pagePath),
    title: referencePage.title,
    description: referencePage.description,
    breadcrumbLinks: buildBreadcrumbLinks(
      [
        {
          name: referencePage.sectionName,
          pagePath: referencePage.sectionPath,
        },
        { name: referencePage.title, pagePath: referencePage.pagePath },
      ],
      buildSiteUrl,
    ),
  });
}
