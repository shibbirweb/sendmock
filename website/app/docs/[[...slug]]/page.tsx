import { getBreadcrumbItems } from "fumadocs-core/breadcrumb";
import { createRelativeLink } from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createDocsLink, getMDXComponents } from "@/components/mdx";
import { StructuredDataScript } from "@/components/seo/structured-data-script";
import {
  buildBreadcrumbLinks,
  toDocsBreadcrumbSteps,
} from "@/lib/seo/breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { buildSiteUrl, siteUrl } from "@/lib/seo/site-url";
import { buildDocsStructuredData } from "@/lib/seo/structured-data";
import { source } from "@/lib/source";

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

type DocsPageData = NonNullable<ReturnType<typeof source.getPage>>;

function buildDocsPageStructuredData(docsPage: DocsPageData) {
  const breadcrumbSteps = [
    { name: "Docs", pagePath: "/docs" },
    ...toDocsBreadcrumbSteps(
      getBreadcrumbItems(docsPage.url, source.getPageTree(), {
        includePage: true,
      }),
    ),
  ];

  return buildDocsStructuredData({
    siteUrl,
    pageUrl: buildSiteUrl(docsPage.url),
    title: docsPage.data.title,
    description: docsPage.data.description ?? "",
    breadcrumbLinks: buildBreadcrumbLinks(breadcrumbSteps, buildSiteUrl),
  });
}

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;
  const docsPage = source.getPage(slug);
  if (!docsPage) {
    notFound();
  }

  const MdxContent = docsPage.data.body;

  return (
    <DocsPage toc={docsPage.data.toc} full={docsPage.data.full}>
      <StructuredDataScript
        structuredData={buildDocsPageStructuredData(docsPage)}
      />
      <DocsTitle>{docsPage.data.title}</DocsTitle>
      <DocsDescription>{docsPage.data.description}</DocsDescription>
      <DocsBody>
        <MdxContent
          components={getMDXComponents({
            a: createDocsLink(createRelativeLink(source, docsPage)),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const docsPage = source.getPage(slug);
  if (!docsPage) {
    notFound();
  }

  return buildPageMetadata({
    title: docsPage.data.title,
    description: docsPage.data.description ?? "",
    pagePath: docsPage.url,
  });
}
