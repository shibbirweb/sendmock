import type { Metadata } from "next";
import Link from "next/link";

import { MethodBadge } from "@/components/api/method-badge";
import {
  indexCliCommandUrls,
  listAreas,
  loadMcpReference,
  toApiOperationUrl,
  toMcpResourceUrl,
  toMcpToolUrl,
} from "@/lib/reference/load-references";
import type { McpReference } from "@/lib/reference/reference-types";

export const metadata: Metadata = {
  title: "MCP reference",
  description:
    "Every SendMock MCP tool and resource with its inputs, hints, an example call and the result, generated from the API contract.",
};

/** On unless the server starts with another `--toolsets` list (docs/plan/14-ai-integration.md). */
const defaultToolsets = [
  "core",
  "email",
  "sms",
  "verify",
  "extract",
  "webhooks",
];

const mcpConfigExample = JSON.stringify(
  { mcpServers: { sendmock: { command: "sendmock", args: ["mcp"] } } },
  null,
  2,
);

function ConnectSection() {
  const aiInstallUrl =
    indexCliCommandUrls().get("sendmock ai install --target <agent>") ?? "/cli";
  return (
    <section aria-labelledby="connect" className="grid gap-2">
      <h2 id="connect" className="text-xl font-semibold">
        Connect an agent
      </h2>
      <p className="text-fd-muted-foreground">
        <code className="font-mono">sendmock mcp</code> runs the MCP server over
        stdio.{" "}
        <Link className="underline" href={aiInstallUrl}>
          <code className="font-mono">
            sendmock ai install --target &lt;agent&gt;
          </code>
        </Link>{" "}
        writes this configuration for Claude Code, Codex, Cursor, Gemini CLI or
        VS Code; the{" "}
        <Link className="underline" href="/docs/ai">
          AI pages
        </Link>{" "}
        show it step by step.
      </p>
      <pre
        tabIndex={0}
        className="overflow-x-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
      >
        {mcpConfigExample}
      </pre>
    </section>
  );
}

function ToolsetsSection({ mcpReference }: { mcpReference: McpReference }) {
  const toolsetNames = [
    ...new Set(mcpReference.tools.map((mcpTool) => mcpTool.toolset)),
  ].sort();
  return (
    <section aria-labelledby="toolsets" className="grid gap-2">
      <h2 id="toolsets" className="text-xl font-semibold">
        Toolsets and hints
      </h2>
      <p className="text-fd-muted-foreground">
        Tools come in toolsets so the agent sees a short list.{" "}
        <code className="font-mono">sendmock mcp --toolsets all</code> turns on
        every toolset; <code className="font-mono">--read-only</code> keeps only
        the tools marked Read only. Harnesses use the hints to approve reads and
        ask before Destructive tools.
      </p>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {toolsetNames.map((toolsetName) => (
          <li key={toolsetName}>
            <code className="font-mono">{toolsetName}</code>{" "}
            <span className="text-fd-muted-foreground">
              {
                mcpReference.tools.filter(
                  (mcpTool) => mcpTool.toolset === toolsetName,
                ).length
              }{" "}
              tools
              {defaultToolsets.includes(toolsetName) ? ", on by default" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-fd-muted-foreground">
        Agents may set secrets but never read them back, so these operations
        have no tool:
      </p>
      <ul className="grid gap-1 text-sm">
        {mcpReference.exemptions.map((mcpExemption) => (
          <li key={mcpExemption.operation.operation_id}>
            <Link
              href={toApiOperationUrl(mcpExemption.operation)}
              className="inline-flex flex-wrap items-center gap-2 underline"
            >
              <MethodBadge method={mcpExemption.operation.method} />
              <code className="font-mono text-xs break-all">
                {mcpExemption.operation.path}
              </code>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function McpReferencePage() {
  const mcpReference = loadMcpReference();
  const areas = listAreas([...mcpReference.tools, ...mcpReference.resources]);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12">
      <header className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">MCP reference</h1>
        <p className="text-fd-muted-foreground">
          The tools and resources SendMock's MCP server gives AI agents. Each
          entry lists the inputs, an example call, the result and the same thing
          from the{" "}
          <Link className="underline" href="/api">
            API
          </Link>{" "}
          and the{" "}
          <Link className="underline" href="/cli">
            CLI
          </Link>{" "}
          ({mcpReference.tools.length} tools, {mcpReference.resources.length}{" "}
          resources).
        </p>
      </header>
      <ConnectSection />
      <ToolsetsSection mcpReference={mcpReference} />
      {areas.map((area) => (
        <section
          key={area.slug}
          aria-labelledby={`area-${area.slug}`}
          className="grid gap-2"
        >
          <h2 id={`area-${area.slug}`} className="text-xl font-semibold">
            <Link href={`/mcp/${area.slug}`} className="hover:underline">
              {area.name}
            </Link>
          </h2>
          <ul className="grid gap-1">
            {mcpReference.tools
              .filter((mcpTool) => mcpTool.area_slug === area.slug)
              .map((mcpTool) => (
                <li key={mcpTool.name}>
                  <Link
                    href={toMcpToolUrl(mcpTool)}
                    className="flex flex-wrap items-baseline gap-x-3 rounded-md px-2 py-1 text-sm hover:bg-fd-accent"
                  >
                    <code className="font-mono text-xs break-all">
                      {mcpTool.name}
                    </code>
                    <span className="hidden text-fd-muted-foreground md:inline">
                      {mcpTool.summary}
                    </span>
                  </Link>
                </li>
              ))}
            {mcpReference.resources
              .filter((mcpResource) => mcpResource.area_slug === area.slug)
              .map((mcpResource) => (
                <li key={mcpResource.slug}>
                  <Link
                    href={toMcpResourceUrl(mcpResource)}
                    className="flex flex-wrap items-baseline gap-x-3 rounded-md px-2 py-1 text-sm hover:bg-fd-accent"
                  >
                    <code className="font-mono text-xs break-all">
                      {mcpResource.uri}
                    </code>
                    <span className="hidden text-fd-muted-foreground md:inline">
                      {mcpResource.summary}
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
