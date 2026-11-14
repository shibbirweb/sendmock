"use client";

import type { ReactNode } from "react";

import {
  formatExampleValue,
  InlineCodeText,
} from "@/components/reference/input-table";
import type {
  ApiOperation,
  SchemaComponents,
} from "@/lib/openapi/openapi-types";
import {
  describeFieldType,
  readAllowedValues,
  type SchemaField,
} from "@/lib/openapi/schema-fields";
import {
  addBodyField,
  parseBodyObject,
  removeBodyField,
} from "@/lib/playground/body-fields";

import type { usePlaygroundRequest } from "./use-playground-request";

type PlaygroundRequestState = ReturnType<typeof usePlaygroundRequest>;

const buttonClassName =
  "rounded-md border px-2 py-0.5 text-xs hover:bg-fd-accent disabled:opacity-50";

/** Description, allowed values, default and example of one input. */
function InputFacts({ inputField }: { inputField: SchemaField }) {
  const hasExample =
    inputField.example !== undefined &&
    inputField.example !== null &&
    formatExampleValue(inputField.example) !== "" &&
    formatExampleValue(inputField.example).length <= 120;

  return (
    <div className="grid gap-0.5 text-xs text-fd-muted-foreground">
      {inputField.description !== "" && (
        <span>
          <InlineCodeText text={inputField.description} />
        </span>
      )}
      {inputField.allowedValues !== null &&
        inputField.allowedValues.length > 0 && (
          <span>
            One of:{" "}
            <InlineCodeText
              text={inputField.allowedValues
                .map(
                  (allowedValue) => `\`${formatExampleValue(allowedValue)}\``,
                )
                .join(", ")}
            />
          </span>
        )}
      {inputField.defaultValue !== undefined && (
        <span>
          Default:{" "}
          <code className="font-mono text-fd-foreground">
            {formatExampleValue(inputField.defaultValue)}
          </code>
        </span>
      )}
      {hasExample && (
        <span>
          Example:{" "}
          <code className="font-mono break-all text-fd-foreground">
            {formatExampleValue(inputField.example)}
          </code>
        </span>
      )}
    </div>
  );
}

function InputRow({
  inputField,
  action,
}: {
  inputField: SchemaField;
  action?: ReactNode;
}) {
  return (
    <li
      className="grid gap-1 border-t py-2"
      style={{ paddingLeft: `${inputField.depth * 0.75}rem` }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <code className="font-mono text-xs font-semibold break-all">
          {inputField.depth > 0 ? inputField.path : inputField.name}
        </code>
        <span className="font-mono text-xs text-fd-muted-foreground">
          {inputField.typeLabel}
        </span>
        {inputField.isRequired && (
          <span className="text-xs text-fd-muted-foreground">required</span>
        )}
        {action}
      </div>
      <InputFacts inputField={inputField} />
    </li>
  );
}

function toParameterField(
  parameter: ApiOperation["parameters"][number],
  schemas: SchemaComponents,
): SchemaField {
  return {
    path: parameter.name,
    name: parameter.name,
    depth: 0,
    typeLabel: describeFieldType(parameter.schema, schemas),
    isRequired: parameter.isRequired,
    description: parameter.description,
    allowedValues: readAllowedValues(parameter.schema, schemas),
    defaultValue: undefined,
    example: parameter.example,
  };
}

function BodyInputs({
  requestState,
}: {
  requestState: PlaygroundRequestState;
}) {
  const bodyObject = parseBodyObject(
    requestState.bodyText.trim() === "" ? "{}" : requestState.bodyText,
  );
  return (
    <ul>
      {requestState.bodyFields.map((bodyField) => {
        const isInBody = bodyObject !== null && bodyField.name in bodyObject;
        const action =
          bodyField.depth > 0 ? undefined : (
            <button
              type="button"
              className={buttonClassName}
              disabled={bodyObject === null}
              aria-label={`${isInBody ? "Remove" : "Add"} ${bodyField.name}`}
              onClick={() =>
                requestState.setBodyText(
                  isInBody
                    ? removeBodyField(requestState.bodyText, bodyField.name)
                    : addBodyField(
                        requestState.bodyText,
                        bodyField.name,
                        bodyField.example,
                      ),
                )
              }
            >
              {isInBody ? "Remove" : "Add"}
            </button>
          );
        return (
          <InputRow
            key={bodyField.path}
            inputField={bodyField}
            action={action}
          />
        );
      })}
    </ul>
  );
}

/**
 * Every input the operation accepts: path and query parameters and every body
 * field, with what it does and what it takes (WS-04.4); body fields can be
 * added to or removed from the body (WS-04.5).
 */
export function InputsPanel({
  operation,
  schemas,
  requestState,
}: {
  operation: ApiOperation;
  schemas: SchemaComponents;
  requestState: PlaygroundRequestState;
}) {
  const parameterGroups = (["path", "query"] as const)
    .map((location) => ({
      location,
      parameters: operation.parameters.filter(
        (parameter) => parameter.location === location,
      ),
    }))
    .filter((parameterGroup) => parameterGroup.parameters.length > 0);

  return (
    <section
      aria-label="Inputs"
      tabIndex={0}
      className="grid max-h-[32rem] content-start gap-3 overflow-y-auto rounded-lg border p-3"
    >
      <h3 className="text-sm font-medium">Inputs</h3>
      {parameterGroups.map((parameterGroup) => (
        <div key={parameterGroup.location} className="grid gap-1">
          <h4 className="text-xs font-medium text-fd-muted-foreground uppercase">
            {parameterGroup.location} parameters
          </h4>
          <ul>
            {parameterGroup.parameters.map((parameter) => (
              <InputRow
                key={parameter.name}
                inputField={toParameterField(parameter, schemas)}
              />
            ))}
          </ul>
        </div>
      ))}
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-fd-muted-foreground uppercase">
            Body
          </h4>
          {operation.requestBody !== null && (
            <button
              type="button"
              className={buttonClassName}
              onClick={requestState.resetBody}
            >
              Reset to example
            </button>
          )}
        </div>
        {operation.requestBody === null ? (
          <p className="text-xs text-fd-muted-foreground">No body.</p>
        ) : requestState.bodyFields.length === 0 ? (
          <p className="text-xs text-fd-muted-foreground">
            Any content, sent as{" "}
            <code className="font-mono">
              {operation.requestBody.contentType}
            </code>
            .
          </p>
        ) : (
          <BodyInputs requestState={requestState} />
        )}
      </div>
    </section>
  );
}
