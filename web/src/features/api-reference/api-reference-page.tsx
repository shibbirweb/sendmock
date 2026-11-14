import { DownloadIcon } from "lucide-react";
import * as React from "react";

import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiOperationItem } from "@/features/api-reference/api-operation-item";
import { usePageTitle } from "@/hooks/use-page-title";
import { openApiDocumentUrl } from "@/lib/api/api-client";
import { useReferenceOperations } from "@/lib/api/hooks/use-openapi-document";
import {
  filterReferenceOperations,
  type ReferenceOperation,
} from "@/lib/api/openapi-reference";

function groupByTag(
  referenceOperations: ReferenceOperation[],
): [string, ReferenceOperation[]][] {
  const operationsByTag = new Map<string, ReferenceOperation[]>();
  for (const referenceOperation of referenceOperations) {
    const tagOperations = operationsByTag.get(referenceOperation.tag) ?? [];
    tagOperations.push(referenceOperation);
    operationsByTag.set(referenceOperation.tag, tagOperations);
  }
  return [...operationsByTag];
}

/** Every operation of this instance's `/api/openapi.json`, by tag, with search (PL-01.4). */
export function ApiReferencePage() {
  usePageTitle("API reference");
  const operationsQuery = useReferenceOperations();
  const [searchText, setSearchText] = React.useState("");
  const shownOperations = filterReferenceOperations(
    operationsQuery.data ?? [],
    searchText,
  );
  const instanceOrigin =
    import.meta.env.VITE_API_BASE_URL ?? window.location.origin;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">API reference</h2>
            <p className="text-sm text-muted-foreground">
              The REST API of this instance, read from its{" "}
              <code className="font-mono">/api/openapi.json</code>. Every
              screen, CLI command and MCP tool calls these endpoints.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <a href={openApiDocumentUrl} download="openapi.json">
              <DownloadIcon />
              Download openapi.json
            </a>
          </Button>
        </header>
        <Input
          type="search"
          aria-label="Search the API"
          placeholder="Search by path, summary or operation"
          value={searchText}
          onChange={(changeEvent) => setSearchText(changeEvent.target.value)}
        />
        {operationsQuery.isPending ? (
          <Skeleton className="h-60" />
        ) : operationsQuery.isError ? (
          <QueryErrorState
            message="Could not load the API reference."
            onRetry={() => void operationsQuery.refetch()}
          />
        ) : (
          <>
            <p role="status" className="text-xs text-muted-foreground">
              {shownOperations.length} of {operationsQuery.data.length}{" "}
              operations
            </p>
            {groupByTag(shownOperations).map(([tag, tagOperations]) => (
              <section key={tag} aria-label={tag} className="grid gap-2">
                <h3 className="text-sm font-semibold">{tag}</h3>
                <ul className="grid gap-2">
                  {tagOperations.map((referenceOperation) => (
                    <ApiOperationItem
                      key={referenceOperation.operationId}
                      referenceOperation={referenceOperation}
                      instanceOrigin={instanceOrigin}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
