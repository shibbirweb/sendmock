export type FormattedHttpBody =
  | { kind: "empty" }
  | { kind: "json"; text: string }
  | { kind: "form"; fields: [fieldName: string, fieldValue: string][] }
  | { kind: "text"; text: string };

const formBodyPattern = /^[\w.[\]%-]+=[^&]*(&[\w.[\]%-]+=[^&]*)*$/;

function tryFormatJson(bodyText: string): string | null {
  try {
    return JSON.stringify(JSON.parse(bodyText), null, 2);
  } catch {
    return null;
  }
}

/**
 * Picks how to show a logged body (SM-13.4): JSON pretty-printed, form
 * bodies as name / value rows, anything else as plain text.
 */
export function formatHttpBody(
  bodyText: string,
  contentType: string | null = null,
): FormattedHttpBody {
  const trimmedBody = bodyText.trim();
  if (trimmedBody === "") {
    return { kind: "empty" };
  }

  const looksLikeJson =
    trimmedBody.startsWith("{") || trimmedBody.startsWith("[");
  if (contentType?.includes("json") === true || looksLikeJson) {
    const prettyJson = tryFormatJson(trimmedBody);
    if (prettyJson !== null) {
      return { kind: "json", text: prettyJson };
    }
  }

  const isFormContentType =
    contentType?.includes("x-www-form-urlencoded") === true;
  if (isFormContentType || formBodyPattern.test(trimmedBody)) {
    return {
      kind: "form",
      fields: [...new URLSearchParams(trimmedBody).entries()],
    };
  }

  return { kind: "text", text: bodyText };
}
