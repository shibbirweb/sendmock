import { describe, expect, test } from "bun:test";

import { buildBreadcrumbLinks, toDocsBreadcrumbSteps } from "./breadcrumbs";
import { listSitemapPages } from "./sitemap-pages";
import {
  authorPersonId,
  buildDocsStructuredData,
  buildLandingStructuredData,
  buildReferenceStructuredData,
  serializeStructuredData,
} from "./structured-data";

const siteUrl = "https://shibbir.me/sendmock/";

function buildTestPageUrl(pagePath: string): string {
  const trimmedPath = pagePath.replace(/^\/+|\/+$/g, "");
  return trimmedPath === "" ? siteUrl : `${siteUrl}${trimmedPath}/`;
}

type GraphNode = Record<string, unknown> & { "@type": string | string[] };

function readGraph(structuredData: Record<string, unknown>): GraphNode[] {
  const parsedData = JSON.parse(serializeStructuredData(structuredData)) as {
    "@context": string;
    "@graph": GraphNode[];
  };
  expect(parsedData["@context"]).toBe("https://schema.org");
  return parsedData["@graph"];
}

describe("structured data", () => {
  test("WS-13.5 the landing page describes SendMock as free developer software by the portfolio's person", () => {
    const [webSite, software] = readGraph(
      buildLandingStructuredData({
        siteUrl,
        description: "A local sandbox.",
      }),
    );

    expect(webSite?.["@type"]).toBe("WebSite");
    expect(software?.["@type"]).toEqual([
      "SoftwareApplication",
      "SoftwareSourceCode",
    ]);
    expect(software).toMatchObject({
      name: "SendMock",
      description: "A local sandbox.",
      url: siteUrl,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Linux, macOS, Windows",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      codeRepository: "https://github.com/shibbirweb/sendmock",
      author: { "@id": "https://shibbir.me#person", name: "MD. Shibbir Ahmed" },
    });
    expect(software?.license).toEqual([
      "https://spdx.org/licenses/MIT.html",
      "https://spdx.org/licenses/Apache-2.0.html",
    ]);
    expect(software?.sameAs).toEqual([
      "https://github.com/shibbirweb/sendmock",
      "https://www.npmjs.com/package/sendmock",
      "https://hub.docker.com/r/shibbirweb/sendmock",
    ]);
    expect(authorPersonId).toBe("https://shibbir.me#person");
  });

  test("WS-13.6 a docs page is a TechArticle with its breadcrumb trail", () => {
    const breadcrumbLinks = buildBreadcrumbLinks(
      [
        { name: "Docs", pagePath: "/docs" },
        { name: "Mail", pagePath: "/docs/mail" },
        { name: "Mail", pagePath: "/docs/mail/" },
        { name: "Attachments", pagePath: "/docs/mail/attachments" },
      ],
      buildTestPageUrl,
    );
    const [article, breadcrumbList] = readGraph(
      buildDocsStructuredData({
        siteUrl,
        pageUrl: `${siteUrl}docs/mail/attachments/`,
        title: "Attachments",
        description: "Open and download attachments.",
        breadcrumbLinks,
      }),
    );

    expect(article).toMatchObject({
      "@type": "TechArticle",
      headline: "Attachments",
      url: `${siteUrl}docs/mail/attachments/`,
    });
    expect(breadcrumbList?.["@type"]).toBe("BreadcrumbList");
    expect(breadcrumbList?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "SendMock", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Docs",
        item: `${siteUrl}docs/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Mail",
        item: `${siteUrl}docs/mail/`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Attachments",
        item: `${siteUrl}docs/mail/attachments/`,
      },
    ]);
  });

  test("WS-13.6 a reference area page is a WebPage with its breadcrumb trail", () => {
    const [webPage, breadcrumbList] = readGraph(
      buildReferenceStructuredData({
        siteUrl,
        pageUrl: `${siteUrl}cli/mail/`,
        title: "Mail commands",
        description: "The Mail commands.",
        breadcrumbLinks: buildBreadcrumbLinks(
          [
            { name: "CLI reference", pagePath: "/cli" },
            { name: "Mail commands", pagePath: "/cli/mail" },
          ],
          buildTestPageUrl,
        ),
      }),
    );

    expect(webPage).toMatchObject({
      "@type": "WebPage",
      name: "Mail commands",
    });
    expect(breadcrumbList?.itemListElement).toHaveLength(3);
  });

  test("WS-13.6 breadcrumb folders without a page of their own are left out", () => {
    expect(
      toDocsBreadcrumbSteps([
        { name: "Guides" },
        { name: "Mail", url: "/docs/mail" },
        { name: "Attachments", url: "/docs/mail/attachments" },
      ]),
    ).toEqual([
      { name: "Mail", pagePath: "/docs/mail" },
      { name: "Attachments", pagePath: "/docs/mail/attachments" },
    ]);
  });

  test("WS-13.6 page text cannot close the script tag", () => {
    expect(
      serializeStructuredData({ name: "</script><script>alert(1)</script>" }),
    ).not.toContain("</script>");
  });
});

describe("the sitemap's pages", () => {
  const sitemapPages = listSitemapPages({
    docsPages: [
      { pagePath: "/docs", wikiFilePath: "index.md" },
      { pagePath: "/docs/install", wikiFilePath: "install.md" },
    ],
    apiTagSlugs: ["mail"],
    cliAreaSlugs: ["sms"],
    mcpAreaSlugs: ["webhooks"],
  });

  test("WS-13.3 lists home, every docs page with What's new and the upgrade guide, and the references, without the playground", () => {
    const pagePaths = sitemapPages.map((sitemapPage) => sitemapPage.pagePath);

    expect(pagePaths).toEqual([
      "/",
      "/docs",
      "/docs/install",
      "/docs/whats-new",
      "/docs/upgrade",
      "/api",
      "/api/mail",
      "/cli",
      "/cli/sms",
      "/mcp",
      "/mcp/webhooks",
      "/changelog",
    ]);
    expect(pagePaths).not.toContain("/playground");
  });

  test("WS-13.9 dates each page from the files its content comes from", () => {
    const sourcesByPath = Object.fromEntries(
      sitemapPages.map((sitemapPage) => [
        sitemapPage.pagePath,
        sitemapPage.sourcePaths,
      ]),
    );

    expect(sourcesByPath["/docs/install"]).toEqual(["docs/wiki/install.md"]);
    expect(sourcesByPath["/docs/whats-new"]).toEqual(["CHANGELOG.md"]);
    expect(sourcesByPath["/changelog"]).toEqual(["CHANGELOG.md"]);
    expect(sourcesByPath["/api/mail"]).toEqual(["docs/api/openapi.yaml"]);
    expect(sourcesByPath["/cli/sms"]).toEqual(["docs/api/cli-reference.json"]);
    expect(sourcesByPath["/mcp/webhooks"]).toEqual(["docs/api/mcp-tools.json"]);
    expect(
      sitemapPages
        .filter((sitemapPage) => sitemapPage.isWebsiteSource)
        .map((sitemapPage) => sitemapPage.pagePath),
    ).toEqual(["/"]);
  });
});
