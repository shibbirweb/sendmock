import Link from "next/link";

import { MethodBadge } from "@/components/api/method-badge";
import type { ReferencedOperation } from "@/lib/reference/reference-types";
import { toApiOperationUrl } from "@/lib/reference/load-references";

export type NamedLink = { name: string; url: string | null };

function NamedLinks({ namedLinks }: { namedLinks: NamedLink[] }) {
  return (
    <>
      {namedLinks.map((namedLink, linkIndex) => (
        <span key={namedLink.name}>
          {linkIndex > 0 && ", "}
          {namedLink.url === null ? (
            <code className="font-mono break-all">{namedLink.name}</code>
          ) : (
            <Link href={namedLink.url} className="underline">
              <code className="font-mono break-all">{namedLink.name}</code>
            </Link>
          )}
        </span>
      ))}
    </>
  );
}

/** The same thing from the REST API, the other surface (CLI or MCP) and the app. */
export function OtherWaysList({
  operations,
  otherSurfaceLabel,
  otherSurfaceLinks,
  uiPlaces,
}: {
  operations: ReferencedOperation[];
  otherSurfaceLabel: string;
  otherSurfaceLinks: NamedLink[];
  uiPlaces: string[];
}) {
  return (
    <dl
      aria-label="Other ways"
      className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"
    >
      <dt className="text-fd-muted-foreground">API</dt>
      <dd className="grid gap-1">
        {operations.map((operation) => (
          <Link
            key={operation.operation_id}
            href={toApiOperationUrl(operation)}
            className="flex flex-wrap items-center gap-2 underline"
          >
            <MethodBadge method={operation.method} />
            <code className="font-mono break-all">{operation.path}</code>
          </Link>
        ))}
      </dd>
      {otherSurfaceLinks.length > 0 && (
        <>
          <dt className="text-fd-muted-foreground">{otherSurfaceLabel}</dt>
          <dd>
            <NamedLinks namedLinks={otherSurfaceLinks} />
          </dd>
        </>
      )}
      <dt className="text-fd-muted-foreground">In the app</dt>
      <dd>{uiPlaces.join("; ")}</dd>
    </dl>
  );
}
