/** JSON values as the literals of languages that do not take JSON directly. */

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const indentUnit = "    ";

function quotePhpString(text: string): string {
  return `'${text.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

/** Returns code to use instead of a string value, or null to quote it. */
export type StringValueRenderer = (stringValue: string) => string | null;

/** A PHP array literal, one entry per line. */
export function toPhpLiteral(
  jsonValue: JsonValue,
  depth = 0,
  renderStringValue: StringValueRenderer = () => null,
): string {
  if (jsonValue === null) {
    return "null";
  }
  if (typeof jsonValue === "string") {
    return renderStringValue(jsonValue) ?? quotePhpString(jsonValue);
  }
  if (typeof jsonValue !== "object") {
    return String(jsonValue);
  }

  const innerIndent = indentUnit.repeat(depth + 1);
  const entries = Array.isArray(jsonValue)
    ? jsonValue.map((arrayItem) =>
        toPhpLiteral(arrayItem, depth + 1, renderStringValue),
      )
    : Object.entries(jsonValue).map(
        ([entryKey, entryValue]) =>
          `${quotePhpString(entryKey)} => ${toPhpLiteral(entryValue, depth + 1, renderStringValue)}`,
      );
  if (entries.length === 0) {
    return "[]";
  }

  return `[\n${entries.map((entry) => `${innerIndent}${entry},`).join("\n")}\n${indentUnit.repeat(depth)}]`;
}

/** A Python literal: JSON with True, False and None. */
export function toPythonLiteral(
  jsonValue: JsonValue,
  depth = 0,
  renderStringValue: StringValueRenderer = () => null,
): string {
  if (jsonValue === null) {
    return "None";
  }
  if (typeof jsonValue === "string") {
    return renderStringValue(jsonValue) ?? JSON.stringify(jsonValue);
  }
  if (typeof jsonValue === "boolean") {
    return jsonValue ? "True" : "False";
  }
  if (typeof jsonValue !== "object") {
    return JSON.stringify(jsonValue);
  }

  const innerIndent = indentUnit.repeat(depth + 1);
  const isList = Array.isArray(jsonValue);
  const entries = isList
    ? jsonValue.map((arrayItem) =>
        toPythonLiteral(arrayItem, depth + 1, renderStringValue),
      )
    : Object.entries(jsonValue).map(
        ([entryKey, entryValue]) =>
          `${JSON.stringify(entryKey)}: ${toPythonLiteral(entryValue, depth + 1, renderStringValue)}`,
      );
  const [openBracket, closeBracket] = isList ? ["[", "]"] : ["{", "}"];
  if (entries.length === 0) {
    return `${openBracket}${closeBracket}`;
  }

  return `${openBracket}\n${entries.map((entry) => `${innerIndent}${entry},`).join("\n")}\n${indentUnit.repeat(depth)}${closeBracket}`;
}

export type { JsonValue };
