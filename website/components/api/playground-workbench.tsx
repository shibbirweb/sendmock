"use client";

import { useState } from "react";

import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";

import { EventStreamPanel } from "./event-stream-panel";
import { ScenarioRunner } from "./scenario-runner";
import { TryItBody } from "./try-it-panel";

/** The full-screen playground: pick any operation, send it, watch the events. */
export function PlaygroundWorkbench({
  operations,
  tagNames,
  schemas,
}: {
  operations: ApiOperation[];
  tagNames: string[];
  schemas: SchemaComponents;
}) {
  const [selectedOperationId, setSelectedOperationId] = useState(
    operations[0]?.operationId ?? "",
  );
  const selectedOperation =
    operations.find(
      (operation) => operation.operationId === selectedOperationId,
    ) ?? operations[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section
        aria-label="Request"
        className="grid min-w-0 content-start gap-4 rounded-xl border p-4"
      >
        <div className="grid gap-1">
          <label htmlFor="operation-select" className="text-sm font-medium">
            Endpoint
          </label>
          <select
            id="operation-select"
            value={selectedOperationId}
            onChange={(changeEvent) =>
              setSelectedOperationId(changeEvent.target.value)
            }
            className="w-full min-w-0 rounded-md border bg-fd-background px-2 py-1.5 font-mono text-xs"
          >
            {tagNames.map((tagName) => (
              <optgroup key={tagName} label={tagName}>
                {operations
                  .filter((operation) => operation.tag === tagName)
                  .map((operation) => (
                    <option
                      key={operation.operationId}
                      value={operation.operationId}
                    >
                      {operation.method} {operation.path}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        {selectedOperation && (
          <>
            <p className="text-sm text-fd-muted-foreground">
              {selectedOperation.summary}
            </p>
            <TryItBody
              key={selectedOperation.operationId}
              operation={selectedOperation}
              schemas={schemas}
            />
          </>
        )}
      </section>
      <div className="grid content-start gap-6">
        <section className="rounded-xl border p-4">
          <EventStreamPanel sinceMs={null} />
        </section>
        <ScenarioRunner />
      </div>
    </div>
  );
}
