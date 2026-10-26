"use client";

import { useState } from "react";

import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";

import { CodeSnippets } from "./code-snippets";
import { EventStreamPanel } from "./event-stream-panel";
import { RequestForm } from "./request-form";
import { ResponseViewer } from "./response-viewer";
import { usePlaygroundRequest } from "./use-playground-request";

/** Build a request, send it to the in-browser demo API, see the answer and snippets. */
export function TryItBody({
  operation,
  schemas,
}: {
  operation: ApiOperation;
  schemas: SchemaComponents;
}) {
  const requestState = usePlaygroundRequest(operation, schemas);

  return (
    <div className="grid gap-4">
      <RequestForm
        operation={operation}
        schemas={schemas}
        requestState={requestState}
      />
      <div>
        <button
          type="button"
          disabled={!requestState.isReady || requestState.isSending}
          onClick={() => void requestState.send()}
          className="rounded-md bg-fd-primary px-4 py-1.5 text-sm font-medium text-fd-primary-foreground disabled:opacity-50"
        >
          {requestState.isReady
            ? "Send to the demo API"
            : "Starting the demo API..."}
        </button>
      </div>
      {requestState.response && (
        <ResponseViewer response={requestState.response} />
      )}
      {requestState.sentAtMs !== null && (
        <EventStreamPanel sinceMs={requestState.sentAtMs} />
      )}
      <CodeSnippets
        snippetRequest={requestState.snippetRequest}
        surfaceSnippets={requestState.surfaceSnippets}
      />
    </div>
  );
}

/**
 * The collapsible "Try it" under each operation in the reference; the builder
 * mounts on first open, so a page of operations does not query the demo API.
 */
export function TryItPanel(props: {
  operation: ApiOperation;
  schemas: SchemaComponents;
}) {
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <details
      className="rounded-lg border bg-fd-card p-3"
      onToggle={(toggleEvent) => {
        if (toggleEvent.currentTarget.open) {
          setHasOpened(true);
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Try it in Demo mode
      </summary>
      {hasOpened && (
        <div className="pt-3">
          <TryItBody {...props} />
        </div>
      )}
    </details>
  );
}
