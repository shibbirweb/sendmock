"use client";

import Link from "next/link";
import { useState } from "react";

import {
  buildSnippet,
  type SnippetLanguage,
  type SnippetRequest,
  snippetLanguages,
} from "@/lib/playground/build-snippets";
import { cn } from "@/lib/utils";

/** The CLI command and MCP call for the same request (WS-04.6). */
export type SurfaceSnippets = {
  cli: { text: string; url: string } | null;
  mcp: { text: string; url: string } | null;
  /** Why there is no MCP tool, for the secret reveals. */
  mcpExemptReason: string | null;
};

type SnippetTab = SnippetLanguage | "cli" | "mcp";

const snippetTabs: { key: SnippetTab; label: string }[] = [
  ...snippetLanguages,
  { key: "cli", label: "CLI" },
  { key: "mcp", label: "MCP" },
];

function SurfaceSnippet({
  snippet,
  referenceName,
  emptyText,
}: {
  snippet: { text: string; url: string } | null;
  referenceName: string;
  emptyText: string;
}) {
  if (snippet === null) {
    return <p className="text-sm text-fd-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="grid gap-1">
      <pre
        data-testid="code-snippet"
        tabIndex={0}
        className="max-h-72 overflow-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
      >
        {snippet.text}
      </pre>
      <Link href={snippet.url} className="text-xs underline">
        Every input in the {referenceName}
      </Link>
    </div>
  );
}

/** The same request in nine languages, the CLI and MCP, for a SendMock on 127.0.0.1:8025. */
export function CodeSnippets({
  snippetRequest,
  surfaceSnippets,
}: {
  snippetRequest: SnippetRequest;
  surfaceSnippets: SurfaceSnippets;
}) {
  const [selectedTab, setSelectedTab] = useState<SnippetTab>("curl");

  return (
    <div className="grid gap-2">
      <div
        role="group"
        aria-label="Snippet language"
        className="flex flex-wrap gap-1"
      >
        {snippetTabs.map((snippetTab) => (
          <button
            key={snippetTab.key}
            type="button"
            aria-pressed={snippetTab.key === selectedTab}
            onClick={() => setSelectedTab(snippetTab.key)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              snippetTab.key === selectedTab
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {snippetTab.label}
          </button>
        ))}
      </div>
      {selectedTab === "cli" ? (
        <SurfaceSnippet
          snippet={surfaceSnippets.cli}
          referenceName="CLI reference"
          emptyText="This operation has no CLI command."
        />
      ) : selectedTab === "mcp" ? (
        <SurfaceSnippet
          snippet={surfaceSnippets.mcp}
          referenceName="MCP reference"
          emptyText={`No MCP tool: ${surfaceSnippets.mcpExemptReason ?? "agents cannot run this operation."}`}
        />
      ) : (
        <pre
          data-testid="code-snippet"
          tabIndex={0}
          className="max-h-72 overflow-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
        >
          {buildSnippet(selectedTab, snippetRequest)}
        </pre>
      )}
    </div>
  );
}
