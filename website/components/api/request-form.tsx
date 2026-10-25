"use client";

import type { ApiOperation } from "@/lib/openapi/openapi-types";
import { describeSchemaType } from "@/lib/openapi/schema-tools";

import type { usePlaygroundRequest } from "./use-playground-request";

type PlaygroundRequestState = ReturnType<typeof usePlaygroundRequest>;

const inputClassName =
  "w-full rounded-md border bg-fd-background px-2 py-1.5 font-mono text-xs focus-visible:outline-2 focus-visible:outline-fd-primary";

/** Path and query fields from the operation's parameters, and the body editor. */
export function RequestForm({
  operation,
  requestState,
}: {
  operation: ApiOperation;
  requestState: PlaygroundRequestState;
}) {
  const fieldIdPrefix = operation.operationId;

  return (
    <div className="grid gap-3">
      {operation.parameters.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {operation.parameters.map((parameter) => {
            const fieldId = `${fieldIdPrefix}-${parameter.location}-${parameter.name}`;
            const valueMap =
              parameter.location === "path"
                ? requestState.pathValues
                : requestState.queryValues;
            const setValueMap =
              parameter.location === "path"
                ? requestState.setPathValues
                : requestState.setQueryValues;
            return (
              <label
                key={fieldId}
                htmlFor={fieldId}
                className="grid gap-1 text-xs"
              >
                <span>
                  <code className="font-mono">{parameter.name}</code>{" "}
                  <span className="text-fd-muted-foreground">
                    {parameter.location}, {describeSchemaType(parameter.schema)}
                    {parameter.isRequired ? ", required" : ""}
                  </span>
                </span>
                <input
                  id={fieldId}
                  className={inputClassName}
                  value={valueMap[parameter.name] ?? ""}
                  placeholder={parameter.description}
                  onChange={(changeEvent) =>
                    setValueMap((previousValues) => ({
                      ...previousValues,
                      [parameter.name]: changeEvent.target.value,
                    }))
                  }
                />
              </label>
            );
          })}
        </div>
      )}
      {operation.requestBody && (
        <label htmlFor={`${fieldIdPrefix}-body`} className="grid gap-1 text-xs">
          <span>
            Body{" "}
            <span className="text-fd-muted-foreground">
              {operation.requestBody.contentType}
            </span>
          </span>
          <textarea
            id={`${fieldIdPrefix}-body`}
            className={`${inputClassName} min-h-32`}
            spellCheck={false}
            value={requestState.bodyText}
            onChange={(changeEvent) =>
              requestState.setBodyText(changeEvent.target.value)
            }
          />
        </label>
      )}
    </div>
  );
}
