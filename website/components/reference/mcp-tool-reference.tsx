import type {
  McpProperty,
  McpResource,
  McpTool,
} from "@/lib/reference/reference-types";

import { InlineCodeText, InputTable, type InputTableRow } from "./input-table";
import { type NamedLink, OtherWaysList } from "./other-ways-list";

function toPropertyRow(mcpProperty: McpProperty): InputTableRow {
  return {
    key: mcpProperty.name,
    name: mcpProperty.name,
    type: mcpProperty.type,
    isRequired: mcpProperty.is_required,
    description: mcpProperty.description,
    allowedValues: mcpProperty.allowed_values,
    example: mcpProperty.example,
  };
}

/** Read only, Destructive, Idempotent: the hints harnesses use to approve calls. */
function AnnotationBadges({
  annotations,
}: {
  annotations: McpTool["annotations"];
}) {
  const badgeLabels = [
    annotations.read_only_hint ? "Read only" : null,
    annotations.destructive_hint ? "Destructive" : null,
    annotations.idempotent_hint ? "Idempotent" : null,
  ].filter((badgeLabel) => badgeLabel !== null);

  return (
    <ul aria-label="Annotations" className="flex flex-wrap gap-1.5">
      {badgeLabels.map((badgeLabel) => (
        <li
          key={badgeLabel}
          className="rounded-md border px-1.5 py-0.5 text-xs text-fd-muted-foreground"
        >
          {badgeLabel}
        </li>
      ))}
    </ul>
  );
}

/** One MCP tool: toolset, hints, inputs, an example call, the result and links. */
export function McpToolReference({
  mcpTool,
  cliLinks,
}: {
  mcpTool: McpTool;
  cliLinks: NamedLink[];
}) {
  const exampleCall = JSON.stringify(
    { name: mcpTool.name, arguments: mcpTool.example_arguments },
    null,
    2,
  );

  return (
    <article
      id={mcpTool.name}
      data-testid="mcp-tool"
      className="grid scroll-mt-20 gap-3 border-t py-8"
    >
      <h2 className="text-lg font-semibold">
        <code className="font-mono break-all">{mcpTool.name}</code>
      </h2>
      <p className="text-fd-muted-foreground">
        <InlineCodeText text={mcpTool.summary} />
      </p>
      <p className="text-sm text-fd-muted-foreground">
        Toolset <code className="font-mono">{mcpTool.toolset}</code>
        {mcpTool.aliases.length > 0 && (
          <>
            ; also answers as{" "}
            <code className="font-mono">{mcpTool.aliases.join(", ")}</code>
          </>
        )}
        .
      </p>
      <AnnotationBadges annotations={mcpTool.annotations} />
      {mcpTool.properties.length > 0 ? (
        <InputTable
          label={`Inputs of ${mcpTool.name}`}
          nameHeading="Input"
          inputRows={mcpTool.properties.map(toPropertyRow)}
        />
      ) : (
        <p className="text-sm text-fd-muted-foreground">No inputs.</p>
      )}
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">Example call</h3>
        <pre
          tabIndex={0}
          data-testid="mcp-example"
          className="max-h-72 overflow-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
        >
          {exampleCall}
        </pre>
      </section>
      <p className="text-sm">
        <span className="text-fd-muted-foreground">Result: </span>
        {mcpTool.output === null ? (
          <span>nothing</span>
        ) : (
          <code className="font-mono break-all">{mcpTool.output}</code>
        )}
      </p>
      <OtherWaysList
        operations={mcpTool.operations}
        otherSurfaceLabel="CLI"
        otherSurfaceLinks={cliLinks}
        uiPlaces={mcpTool.ui}
      />
    </article>
  );
}

/** One MCP resource: a file or raw content an agent reads by URI. */
export function McpResourceReference({
  mcpResource,
  cliLinks,
}: {
  mcpResource: McpResource;
  cliLinks: NamedLink[];
}) {
  return (
    <article
      id={mcpResource.slug}
      data-testid="mcp-resource"
      className="grid scroll-mt-20 gap-3 border-t py-8"
    >
      <h2 className="text-lg font-semibold">
        <code className="font-mono break-all">{mcpResource.uri}</code>
      </h2>
      <p className="text-fd-muted-foreground">
        <InlineCodeText text={mcpResource.summary} />
      </p>
      <p className="text-sm text-fd-muted-foreground">
        Resource, read as{" "}
        <code className="font-mono">{mcpResource.mime_type}</code>.
      </p>
      {mcpResource.parameters.length > 0 && (
        <InputTable
          label={`Parameters of ${mcpResource.uri}`}
          nameHeading="Parameter"
          inputRows={mcpResource.parameters.map(toPropertyRow)}
        />
      )}
      <OtherWaysList
        operations={[mcpResource.operation]}
        otherSurfaceLabel="CLI"
        otherSurfaceLinks={cliLinks}
        uiPlaces={[mcpResource.ui]}
      />
    </article>
  );
}
