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

/** Multipart parts as name / value rows; a file part shows its file name (HC-01.2). */
function parseMultipartFields(
  bodyText: string,
  contentType: string,
): [fieldName: string, fieldValue: string][] | null {
  const boundary = /boundary=("?)([^";]+)\1/.exec(contentType)?.[2];
  if (boundary === undefined) {
    return null;
  }

  return bodyText
    .split(`--${boundary}`)
    .slice(1)
    .flatMap((partText): [string, string][] => {
      const headerEndIndex = partText.indexOf("\r\n\r\n");
      if (headerEndIndex === -1) {
        return [];
      }
      const partHeaders = partText.slice(0, headerEndIndex);
      const fieldName = /name="([^"]*)"/.exec(partHeaders)?.[1];
      const fileName = /filename="([^"]*)"/.exec(partHeaders)?.[1];
      if (fieldName === undefined) {
        return [];
      }
      const partValue = partText.slice(headerEndIndex + 4).replace(/\r\n$/, "");

      return [
        [fieldName, fileName === undefined ? partValue : `${fileName} (file)`],
      ];
    });
}

/**
 * Picks how to show a logged body (SM-13.4): JSON pretty-printed, form
 * and multipart bodies as name / value rows, anything else as plain text.
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

  if (contentType?.includes("multipart/form-data") === true) {
    const multipartFields = parseMultipartFields(bodyText, contentType);
    if (multipartFields !== null) {
      return { kind: "form", fields: multipartFields };
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
