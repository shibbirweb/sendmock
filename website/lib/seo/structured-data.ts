/**
 * schema.org JSON-LD for search engines. The author is the Person node the
 * portfolio at shibbir.me publishes; it owns the details, so only the name is
 * repeated here.
 */

export type StructuredDataNode = Record<string, unknown>;

export type BreadcrumbLink = {
  name: string;
  /** Absolute page URL. */
  url: string;
};

export const authorPersonId = "https://shibbir.me#person";
export const authorName = "MD. Shibbir Ahmed";

export const projectProfileUrls = [
  "https://github.com/shibbirweb/sendmock",
  "https://www.npmjs.com/package/sendmock",
  "https://hub.docker.com/r/shibbirweb/sendmock",
];

const author = { "@id": authorPersonId, name: authorName };

function buildWebSiteId(siteUrl: string): string {
  return `${siteUrl}#website`;
}

function buildWebSiteNode(siteUrl: string): StructuredDataNode {
  return {
    "@type": "WebSite",
    "@id": buildWebSiteId(siteUrl),
    url: siteUrl,
    name: "SendMock",
    inLanguage: "en",
    author,
  };
}

function buildBreadcrumbListNode(
  pageUrl: string,
  breadcrumbLinks: BreadcrumbLink[],
): StructuredDataNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: breadcrumbLinks.map((breadcrumbLink, linkIndex) => ({
      "@type": "ListItem",
      position: linkIndex + 1,
      name: breadcrumbLink.name,
      item: breadcrumbLink.url,
    })),
  };
}

export type LandingStructuredDataInput = {
  siteUrl: string;
  description: string;
};

/**
 * The landing page: the site and the app. The app is also typed
 * SoftwareSourceCode, the type `codeRepository` belongs to.
 */
export function buildLandingStructuredData(
  landingInput: LandingStructuredDataInput,
): StructuredDataNode {
  const { siteUrl, description } = landingInput;

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildWebSiteNode(siteUrl),
      {
        "@type": ["SoftwareApplication", "SoftwareSourceCode"],
        "@id": `${siteUrl}#software`,
        name: "SendMock",
        description,
        url: siteUrl,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Linux, macOS, Windows",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        license: [
          "https://spdx.org/licenses/MIT.html",
          "https://spdx.org/licenses/Apache-2.0.html",
        ],
        codeRepository: projectProfileUrls[0],
        sameAs: projectProfileUrls,
        author,
        isPartOf: { "@id": buildWebSiteId(siteUrl) },
      },
    ],
  };
}

export type PageStructuredDataInput = {
  siteUrl: string;
  pageUrl: string;
  title: string;
  description: string;
  /** From the site root to this page, this page included. */
  breadcrumbLinks: BreadcrumbLink[];
};

/** A docs guide: a TechArticle with its breadcrumb trail. */
export function buildDocsStructuredData(
  pageInput: PageStructuredDataInput,
): StructuredDataNode {
  const { siteUrl, pageUrl, title, description, breadcrumbLinks } = pageInput;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${pageUrl}#article`,
        url: pageUrl,
        headline: title,
        description,
        inLanguage: "en",
        author,
        isPartOf: { "@id": buildWebSiteId(siteUrl) },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      buildBreadcrumbListNode(pageUrl, breadcrumbLinks),
    ],
  };
}

/** A reference page (API, CLI or MCP area): a WebPage with its breadcrumb trail. */
export function buildReferenceStructuredData(
  pageInput: PageStructuredDataInput,
): StructuredDataNode {
  const { siteUrl, pageUrl, title, description, breadcrumbLinks } = pageInput;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: title,
        description,
        inLanguage: "en",
        isPartOf: { "@id": buildWebSiteId(siteUrl) },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      buildBreadcrumbListNode(pageUrl, breadcrumbLinks),
    ],
  };
}

/** JSON for a script tag: "<" escaped so page text can never close the tag. */
export function serializeStructuredData(
  structuredData: StructuredDataNode,
): string {
  return JSON.stringify(structuredData).replace(/</g, "\\u003c");
}
