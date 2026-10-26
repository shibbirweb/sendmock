import Link from "next/link";

import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";
import {
  collectSchemaNames,
  describeSchemaType,
} from "@/lib/openapi/schema-tools";

import { MethodBadge } from "./method-badge";
import { SchemaTable } from "./schema-table";
import { TryItPanel } from "./try-it-panel";

/** Only the schemas the operation's body needs, so each page stays small. */
function pickBodySchemas(
  operation: ApiOperation,
  schemas: SchemaComponents,
): SchemaComponents {
  if (operation.requestBody === null) {
    return {};
  }
  const schemaNames = collectSchemaNames(
    [operation.requestBody.schema],
    schemas,
  );
  return Object.fromEntries(
    [...schemaNames].map((schemaName) => [
      schemaName,
      schemas[schemaName] ?? {},
    ]),
  );
}

/** A CLI command or MCP tool, linked to its reference entry (WS-07.4). */
function ReferenceLink({ url, name }: { url: string | null; name: string }) {
  const nameCode = <code className="font-mono break-all">{name}</code>;

  return url === null ? (
    nameCode
  ) : (
    <Link href={url} className="underline">
      {nameCode}
    </Link>
  );
}

/** The same operation from the terminal, an AI agent and the UI (UI-11.3). */
function OperationSurfacesList({
  surfaces,
}: {
  surfaces: ApiOperation["surfaces"];
}) {
  return (
    <dl
      aria-label="Other ways"
      className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"
    >
      <dt className="text-fd-muted-foreground">CLI</dt>
      <dd>
        <ReferenceLink url={surfaces.cliUrl} name={surfaces.cli} />
      </dd>
      <dt className="text-fd-muted-foreground">MCP tool</dt>
      <dd>
        {surfaces.mcp === null ? (
          <span>None: {surfaces.mcpExemptReason}</span>
        ) : (
          <ReferenceLink url={surfaces.mcpUrl} name={surfaces.mcp} />
        )}
      </dd>
      <dt className="text-fd-muted-foreground">In the app</dt>
      <dd>{surfaces.ui}</dd>
    </dl>
  );
}

/** One operation: method and path, parameters, body, answers and Try it. */
export function OperationReference({
  operation,
  schemas,
}: {
  operation: ApiOperation;
  schemas: SchemaComponents;
}) {
  const successResponse = operation.responses.find((response) =>
    /^2/.test(response.status),
  );
  const errorStatuses = operation.responses
    .filter((response) => /^[45]/.test(response.status))
    .map((response) => response.status);

  return (
    <article
      id={operation.operationId}
      data-testid="api-operation"
      className="grid scroll-mt-20 gap-3 border-t py-8"
    >
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        <MethodBadge method={operation.method} />
        <code className="font-mono text-base break-all">{operation.path}</code>
      </h2>
      <p className="text-fd-muted-foreground">{operation.summary}</p>
      <OperationSurfacesList surfaces={operation.surfaces} />
      {operation.requestBody && (
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">
            Request body ({operation.requestBody.contentType})
          </h3>
          <SchemaTable
            schema={operation.requestBody.schema}
            schemas={schemas}
          />
        </section>
      )}
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">Answer</h3>
        <p className="text-sm">
          <code className="font-mono">{successResponse?.status ?? "200"}</code>{" "}
          {successResponse?.body ? (
            <code className="font-mono">
              {describeSchemaType(successResponse.body.schema)}
            </code>
          ) : (
            <span className="text-fd-muted-foreground">No content</span>
          )}
          {successResponse?.body &&
            !successResponse.body.contentType.includes("json") && (
              <span className="text-fd-muted-foreground">
                {" "}
                ({successResponse.body.contentType})
              </span>
            )}
        </p>
        {errorStatuses.length > 0 && (
          <p className="text-sm text-fd-muted-foreground">
            Errors: {errorStatuses.join(", ")}, as{" "}
            <code className="font-mono">{"{ error: { code, message } }"}</code>
          </p>
        )}
      </section>
      <TryItPanel
        operation={operation}
        schemas={pickBodySchemas(operation, schemas)}
      />
    </article>
  );
}
