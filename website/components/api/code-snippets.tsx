"use client";

import { useState } from "react";

import {
  buildSnippet,
  type SnippetLanguage,
  type SnippetRequest,
  snippetLanguages,
} from "@/lib/playground/build-snippets";
import { cn } from "@/lib/utils";

/** The same request in nine languages, for a SendMock on 127.0.0.1:8025. */
export function CodeSnippets({
  snippetRequest,
}: {
  snippetRequest: SnippetRequest;
}) {
  const [selectedLanguage, setSelectedLanguage] =
    useState<SnippetLanguage>("curl");

  return (
    <div className="grid gap-2">
      <div
        role="group"
        aria-label="Snippet language"
        className="flex flex-wrap gap-1"
      >
        {snippetLanguages.map((snippetLanguage) => (
          <button
            key={snippetLanguage.key}
            type="button"
            aria-pressed={snippetLanguage.key === selectedLanguage}
            onClick={() => setSelectedLanguage(snippetLanguage.key)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              snippetLanguage.key === selectedLanguage
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {snippetLanguage.label}
          </button>
        ))}
      </div>
      <pre
        data-testid="code-snippet"
        className="max-h-72 overflow-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
      >
        {buildSnippet(selectedLanguage, snippetRequest)}
      </pre>
    </div>
  );
}
