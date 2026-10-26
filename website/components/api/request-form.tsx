"use client";

import { InlineCodeText } from "@/components/reference/input-table";
import type {
  ApiOperation,
  ApiParameter,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";
import {
  describeFieldType,
  readAllowedValues,
} from "@/lib/openapi/schema-fields";

import { InputsPanel } from "./inputs-panel";
import type { usePlaygroundRequest } from "./use-playground-request";

type PlaygroundRequestState = ReturnType<typeof usePlaygroundRequest>;

const inputClassName =
  "w-full rounded-md border bg-fd-background px-2 py-1.5 font-mono text-xs focus-visible:outline-2 focus-visible:outline-fd-primary";

/**
 * One path or query field: a dropdown when the values are fixed, a checkbox
 * for a yes/no query parameter, a text box otherwise (WS-04.5).
 */
function ParameterControl({
  fieldId,
  parameter,
  schemas,
  value,
  onChange,
}: {
  fieldId: string;
  parameter: ApiParameter;
  schemas: SchemaComponents;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const allowedValues = readAllowedValues(parameter.schema, schemas);
  if (
    parameter.location === "query" &&
    describeFieldType(parameter.schema, schemas) === "boolean"
  ) {
    return (
      <input
        id={fieldId}
        type="checkbox"
        className="size-4 accent-fd-primary"
        checked={value === "true"}
        onChange={(changeEvent) =>
          onChange(changeEvent.target.checked ? "true" : "")
        }
      />
    );
  }
  if (allowedValues !== null && allowedValues.length > 0) {
    return (
      <select
        id={fieldId}
        className={inputClassName}
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      >
        {!parameter.isRequired && <option value="">(not sent)</option>}
        {allowedValues.map((allowedValue) => (
          <option key={String(allowedValue)} value={String(allowedValue)}>
            {String(allowedValue)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={fieldId}
      className={inputClassName}
      value={value}
      placeholder={
        parameter.example === undefined ? "" : String(parameter.example)
      }
      onChange={(changeEvent) => onChange(changeEvent.target.value)}
    />
  );
}

function BodyProblems({ bodyProblems }: { bodyProblems: string[] }) {
  return (
    <div role="status" aria-label="Body check" className="text-xs">
      {bodyProblems.length > 0 && (
        <ul className="grid list-disc gap-0.5 pl-4 text-fd-muted-foreground">
          {bodyProblems.map((bodyProblem) => (
            <li key={bodyProblem}>
              <InlineCodeText text={bodyProblem} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Path and query fields, the body editor and its hints, beside every input the operation takes. */
export function RequestForm({
  operation,
  schemas,
  requestState,
}: {
  operation: ApiOperation;
  schemas: SchemaComponents;
  requestState: PlaygroundRequestState;
}) {
  const fieldIdPrefix = operation.operationId;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <div className="grid content-start gap-3">
        {operation.parameters.length > 0 && (
          <div className="grid gap-2">
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
                      {parameter.location},{" "}
                      {describeFieldType(parameter.schema, schemas)}
                      {parameter.isRequired ? ", required" : ""}
                    </span>
                  </span>
                  <ParameterControl
                    fieldId={fieldId}
                    parameter={parameter}
                    schemas={schemas}
                    value={valueMap[parameter.name] ?? ""}
                    onChange={(nextValue) =>
                      setValueMap((previousValues) => ({
                        ...previousValues,
                        [parameter.name]: nextValue,
                      }))
                    }
                  />
                </label>
              );
            })}
          </div>
        )}
        {operation.requestBody && (
          <div className="grid gap-1">
            <label htmlFor={`${fieldIdPrefix}-body`} className="text-xs">
              Body{" "}
              <span className="text-fd-muted-foreground">
                {operation.requestBody.contentType}
              </span>
            </label>
            <textarea
              id={`${fieldIdPrefix}-body`}
              className={`${inputClassName} min-h-48`}
              spellCheck={false}
              value={requestState.bodyText}
              onChange={(changeEvent) =>
                requestState.setBodyText(changeEvent.target.value)
              }
            />
            <BodyProblems bodyProblems={requestState.bodyProblems} />
          </div>
        )}
      </div>
      <InputsPanel
        operation={operation}
        schemas={schemas}
        requestState={requestState}
      />
    </div>
  );
}
