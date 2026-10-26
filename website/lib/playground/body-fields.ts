/**
 * Edits the playground's JSON body one field at a time and points out
 * problems before sending (docs/plan/21-reference-and-examples.md, WS-04.5).
 */
import type { SchemaField } from "@/lib/openapi/schema-fields";

/** The body as an object, or null when it is not a JSON object. */
export function parseBodyObject(
  bodyText: string,
): Record<string, unknown> | null {
  try {
    const parsedBody: unknown = JSON.parse(bodyText);
    return parsedBody !== null &&
      typeof parsedBody === "object" &&
      !Array.isArray(parsedBody)
      ? (parsedBody as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeBody(bodyObject: Record<string, unknown>): string {
  return JSON.stringify(bodyObject, null, 2);
}

/** Adds a top-level field with its example, keeping the fields already there. */
export function addBodyField(
  bodyText: string,
  fieldName: string,
  fieldValue: unknown,
): string {
  const bodyObject = parseBodyObject(bodyText.trim() === "" ? "{}" : bodyText);
  if (bodyObject === null) {
    return bodyText;
  }

  return writeBody({ ...bodyObject, [fieldName]: fieldValue });
}

export function removeBodyField(bodyText: string, fieldName: string): string {
  const bodyObject = parseBodyObject(bodyText);
  if (bodyObject === null) {
    return bodyText;
  }
  const { [fieldName]: _removedValue, ...remainingFields } = bodyObject;

  return writeBody(remainingFields);
}

function formatValueList(allowedValues: unknown[]): string {
  return allowedValues
    .map((allowedValue) => `\`${String(allowedValue)}\``)
    .join(", ");
}

/** Problems with a JSON body: invalid JSON, unknown or missing fields, values not allowed. */
export function findBodyProblems(
  bodyText: string,
  topLevelFields: SchemaField[],
): string[] {
  if (bodyText.trim() === "") {
    return topLevelFields.some((field) => field.isRequired)
      ? ["The body is empty."]
      : [];
  }
  try {
    JSON.parse(bodyText);
  } catch (parseError) {
    return [`The body is not valid JSON: ${(parseError as Error).message}`];
  }
  const bodyObject = parseBodyObject(bodyText);
  if (bodyObject === null) {
    return ["The body should be a JSON object."];
  }
  const fieldsByName = new Map(
    topLevelFields.map((field) => [field.name, field]),
  );
  const unknownProblems = Object.keys(bodyObject)
    .filter((fieldName) => !fieldsByName.has(fieldName))
    .map(
      (fieldName) =>
        `\`${fieldName}\` is not a field of this request; SendMock ignores it.`,
    );
  const missingProblems = topLevelFields
    .filter((field) => field.isRequired && !(field.name in bodyObject))
    .map((field) => `\`${field.name}\` is required.`);
  const valueProblems = topLevelFields.flatMap((field) => {
    const fieldValue = bodyObject[field.name];
    const allowedValues = field.allowedValues;
    if (
      allowedValues === null ||
      fieldValue === undefined ||
      fieldValue === null
    ) {
      return [];
    }
    const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
    return values.every((value) => allowedValues.includes(value))
      ? []
      : [`\`${field.name}\` must be one of ${formatValueList(allowedValues)}.`];
  });

  return [...unknownProblems, ...missingProblems, ...valueProblems];
}
