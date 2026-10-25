import type { Metadata } from "next";
import Link from "next/link";

import { MethodBadge } from "@/components/api/method-badge";
import { loadApiReference, toTagSlug } from "@/lib/openapi/load-openapi";

export const metadata: Metadata = {
  title: "API reference",
  description:
    "Every SendMock REST endpoint, generated from the frozen OpenAPI 3.1 contract, with a playground on each.",
};

export default function ApiReferencePage() {
  const { operations, tagNames } = loadApiReference();

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12">
      <header className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">API reference</h1>
        <p className="text-fd-muted-foreground">
          SendMock's REST API at{" "}
          <code className="font-mono">http://127.0.0.1:8025</code>: JSON in and
          out, snake_case fields, errors as{" "}
          <code className="font-mono">{"{ error: { code, message } }"}</code>{" "}
          and paged lists with an opaque{" "}
          <code className="font-mono">next_cursor</code>. Generated from{" "}
          <code className="font-mono">docs/api/openapi.yaml</code> (
          {operations.length} operations).
        </p>
        <p className="text-fd-muted-foreground">
          Every operation has <strong>Try it in Demo mode</strong>: requests are
          answered in your browser by the same mock API as the{" "}
          <a className="underline" href="../demo/">
            live demo
          </a>
          . The{" "}
          <Link className="underline" href="/playground">
            playground
          </Link>{" "}
          adds an event stream and multi-step scenarios.
        </p>
      </header>
      {tagNames.map((tagName) => (
        <section
          key={tagName}
          aria-labelledby={`tag-${toTagSlug(tagName)}`}
          className="grid gap-2"
        >
          <h2
            id={`tag-${toTagSlug(tagName)}`}
            className="text-xl font-semibold"
          >
            <Link
              href={`/api/${toTagSlug(tagName)}`}
              className="hover:underline"
            >
              {tagName}
            </Link>
          </h2>
          <ul className="grid gap-1">
            {operations
              .filter((operation) => operation.tag === tagName)
              .map((operation) => (
                <li key={operation.operationId}>
                  <Link
                    href={`/api/${operation.tagSlug}#${operation.operationId}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-fd-accent"
                  >
                    <MethodBadge method={operation.method} />
                    <code className="font-mono text-xs break-all">
                      {operation.path}
                    </code>
                    <span className="hidden text-fd-muted-foreground md:inline">
                      {operation.summary}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
