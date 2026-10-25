import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OperationReference } from "@/components/api/operation-reference";
import { loadApiReference, toTagSlug } from "@/lib/openapi/load-openapi";

type TagPageProps = { params: Promise<{ tag: string }> };

export function generateStaticParams() {
  return loadApiReference().tagNames.map((tagName) => ({
    tag: toTagSlug(tagName),
  }));
}

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const tagName = loadApiReference().tagNames.find(
    (name) => toTagSlug(name) === tag,
  );
  return {
    title: `${tagName ?? "API"} API`,
    description: `The ${tagName} endpoints of the SendMock REST API.`,
  };
}

export default async function ApiTagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const { operations, tagNames, schemas } = loadApiReference();
  const tagName = tagNames.find((name) => toTagSlug(name) === tag);
  if (tagName === undefined) {
    notFound();
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-2 px-4 py-12">
      <p className="text-sm">
        <Link href="/api" className="text-fd-muted-foreground hover:underline">
          API reference
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{tagName}</h1>
      {operations
        .filter((operation) => operation.tag === tagName)
        .map((operation) => (
          <OperationReference
            key={operation.operationId}
            operation={operation}
            schemas={schemas}
          />
        ))}
    </main>
  );
}
