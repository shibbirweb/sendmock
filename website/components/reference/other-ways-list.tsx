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

/** Which input value picks this operation, for a command or tool that runs several. */
export function describeSelector(
  selector: ReferencedOperation["selector"],
): string | null {
  if (selector === null) {
    return null;
  }
  if (selector.value !== undefined) {
    return `${selector.input}: ${selector.value}`;
  }
  if (selector.isGiven !== undefined) {
    return `${selector.isGiven ? "with" : "without"} ${selector.input}`;
  }
  return null;
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
  const isShared = operations.length > 1;

  return (
    <dl
      aria-label="Other ways"
      className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"
    >
      <dt className="text-fd-muted-foreground">API</dt>
      <dd className="grid gap-1">
        {operations.map((operation) => {
          const selectorText = isShared
            ? describeSelector(operation.selector)
            : null;
          return (
            <span
              key={operation.operation_id}
              className="flex flex-wrap items-center gap-2"
            >
              {selectorText !== null && (
                <code
                  data-testid="operation-selector"
                  className="font-mono text-xs text-fd-muted-foreground"
                >
                  {selectorText}
                </code>
              )}
              <Link
                href={toApiOperationUrl(operation)}
                className="flex flex-wrap items-center gap-2 underline"
              >
                <MethodBadge method={operation.method} />
                <code className="font-mono break-all">{operation.path}</code>
              </Link>
            </span>
          );
        })}
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
