import type { ProviderOperation, ProviderSampleRequest } from "@/lib/api/types";

/** A request's body as a value: parsed JSON, or the fields of a form or query. */
export type ParsedRequestBody = unknown;

export type MatchedOperation = {
  operation: ProviderOperation;
  pathParams: Record<string, string>;
};

/** Reads a body in the operation's format; a JSON body that does not parse is null. */
export function parseRequestBody(
  requestFormat: ProviderOperation["request_format"],
  requestBody: string,
): ParsedRequestBody {
  if (requestFormat === "json") {
    if (requestBody.trim() === "") {
      return {};
    }
    try {
      return JSON.parse(requestBody) as unknown;
    } catch {
      return null;
    }
  }
  const formFields: Record<string, string | string[]> = {};
  new URLSearchParams(requestBody).forEach((fieldValue, fieldName) => {
    const existingValue = formFields[fieldName];
    formFields[fieldName] =
      existingValue === undefined
        ? fieldValue
        : [existingValue, fieldValue].flat();
  });

  return formFields;
}

function toPathPattern(operationPath: string): RegExp {
  const escapedPath = operationPath
    .split(/(\{[^}]+\})/)
    .map((pathPart) =>
      pathPart.startsWith("{")
        ? `(?<${pathPart.slice(1, -1).replace(/[^A-Za-z0-9_]/g, "_")}>[^/]+)`
        : pathPart.replace(/[.*+?^$()|[\]\\]/g, "\\$&"),
    )
    .join("");

  return new RegExp(`^${escapedPath}$`);
}

/** The operation a request is for, with the values of its `{name}` parts. */
export function matchOperation(
  operations: ProviderOperation[],
  sampleRequest: Pick<ProviderSampleRequest, "method" | "path">,
): MatchedOperation | undefined {
  const requestPath = sampleRequest.path.split("?")[0] ?? "";
  for (const operation of operations) {
    if (operation.method !== sampleRequest.method) {
      continue;
    }
    const pathMatch = toPathPattern(operation.path).exec(requestPath);
    if (pathMatch !== null) {
      return { operation, pathParams: { ...pathMatch.groups } };
    }
  }

  return undefined;
}

/** `a.b[0].c`, `a[*]` and `content[type=text/plain]` as steps. */
function splitSourcePath(sourcePath: string): string[] {
  return sourcePath
    .replace(/\[([^\]]*)\]/g, ".[$1]")
    .split(".")
    .filter((pathStep) => pathStep !== "");
}

function stepInto(currentValues: unknown[], pathStep: string): unknown[] {
  return currentValues.flatMap((currentValue) => {
    if (pathStep.startsWith("[")) {
      const selector = pathStep.slice(1, -1);
      const listValue = Array.isArray(currentValue) ? currentValue : [];
      if (selector === "*") {
        return listValue;
      }
      if (/^\d+$/.test(selector)) {
        return listValue[Number(selector)] === undefined
          ? []
          : [listValue[Number(selector)]];
      }
      const [selectorField, selectorValue] = selector.split("=");

      return listValue.filter(
        (listItem) =>
          typeof listItem === "object" &&
          listItem !== null &&
          String((listItem as Record<string, unknown>)[selectorField ?? ""]) ===
            selectorValue,
      );
    }
    if (typeof currentValue !== "object" || currentValue === null) {
      return [];
    }
    const nestedValue = (currentValue as Record<string, unknown>)[pathStep];

    return nestedValue === undefined ? [] : [nestedValue];
  });
}

function toTextValues(readValues: unknown[]): string[] {
  return readValues.flatMap((readValue) => {
    if (Array.isArray(readValue)) {
      return toTextValues(readValue);
    }
    if (readValue === null || readValue === undefined || readValue === "") {
      return [];
    }

    return [
      typeof readValue === "object"
        ? JSON.stringify(readValue)
        : String(readValue),
    ];
  });
}

/** Every value a mapping source reads; `h:*` reads each field starting with `h:`. */
export function readSourceValues(
  parsedBody: ParsedRequestBody,
  sourcePath: string,
): string[] {
  if (sourcePath.endsWith("*") && !sourcePath.includes("[")) {
    const fieldPrefix = sourcePath.slice(0, -1);
    const bodyFields =
      typeof parsedBody === "object" && parsedBody !== null
        ? Object.entries(parsedBody as Record<string, unknown>)
        : [];

    return bodyFields
      .filter(([fieldName]) => fieldName.startsWith(fieldPrefix))
      .map(([fieldName, fieldValue]) => `${fieldName}: ${String(fieldValue)}`);
  }

  return toTextValues(
    splitSourcePath(sourcePath).reduce<unknown[]>(stepInto, [parsedBody]),
  );
}
