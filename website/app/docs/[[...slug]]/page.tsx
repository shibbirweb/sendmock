import { createRelativeLink } from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMDXComponents } from "@/components/mdx";
import { source } from "@/lib/source";

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;
  const docsPage = source.getPage(slug);
  if (!docsPage) {
    notFound();
  }

  const MdxContent = docsPage.data.body;

  return (
    <DocsPage toc={docsPage.data.toc} full={docsPage.data.full}>
      <DocsTitle>{docsPage.data.title}</DocsTitle>
      <DocsDescription>{docsPage.data.description}</DocsDescription>
      <DocsBody>
        <MdxContent
          components={getMDXComponents({
            a: createRelativeLink(source, docsPage),
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

  return {
    title: docsPage.data.title,
    description: docsPage.data.description,
  };
}
