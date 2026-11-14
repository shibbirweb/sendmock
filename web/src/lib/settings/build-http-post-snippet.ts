import type { SnippetLanguage } from "@/lib/settings/build-connection-snippets";
import {
  buildFileReadLines,
  type FilePlaceholder,
  findFilePlaceholders,
  readFileName,
} from "@/lib/settings/file-placeholders";
import {
  type JsonValue,
  type StringValueRenderer,
  toPhpLiteral,
  toPythonLiteral,
} from "@/lib/settings/json-literals";

export type SnippetHeader = {
  headerName: string;
  headerValue: string;
};

type PostRequest = {
  requestUrl: string;
  requestHeaders: SnippetHeader[];
  requestBody: JsonValue;
};

type RenderedPostRequest = PostRequest & {
  filePlaceholders: FilePlaceholder[];
};

const contentTypeHeader: SnippetHeader = {
  headerName: "Content-Type",
  headerValue: "application/json",
};

function quoteSingle(text: string): string {
  return text.replaceAll("'", "'\\''");
}

function toHeaderObject(requestHeaders: SnippetHeader[]) {
  return Object.fromEntries(
    requestHeaders.map(({ headerName, headerValue }) => [
      headerName,
      headerValue,
    ]),
  );
}

/** Puts each file's variable where its placeholder string was. */
function buildVariableRenderer(
  filePlaceholders: FilePlaceholder[],
): StringValueRenderer {
  return (stringValue) => {
    const fileName = readFileName(stringValue);

    return (
      filePlaceholders.find(
        (filePlaceholder) => filePlaceholder.fileName === fileName,
      )?.variableName ?? null
    );
  };
}

/** Replaces each quoted placeholder in JSON text with code for its variable. */
function replaceQuotedPlaceholders(
  jsonText: string,
  filePlaceholders: FilePlaceholder[],
  renderVariable: (filePlaceholder: FilePlaceholder) => string,
): string {
  return filePlaceholders.reduce(
    (updatedText, filePlaceholder) =>
      updatedText.replaceAll(
        JSON.stringify(filePlaceholder.placeholderText),
        renderVariable(filePlaceholder),
      ),
    jsonText,
  );
}

/** `.replace("{{file:x}}", xContent)` calls that fill a JSON string in. */
function buildReplaceChain(
  filePlaceholders: FilePlaceholder[],
  replaceMethod: string,
): string {
  return filePlaceholders
    .map(
      ({ placeholderText, variableName }) =>
        `.${replaceMethod}(${JSON.stringify(placeholderText)}, ${variableName})`,
    )
    .join("");
}

function buildCurlSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headerLines = [contentTypeHeader, ...requestHeaders].map(
    ({ headerName, headerValue }) =>
      `  -H "${`${headerName}: ${headerValue}`.replaceAll('"', '\\"')}" \\`,
  );
  if (filePlaceholders.length === 0) {
    return [
      `curl -X POST ${requestUrl} \\`,
      ...headerLines,
      `  -d '${quoteSingle(JSON.stringify(requestBody))}'`,
    ].join("\n");
  }

  // A heredoc lets the shell put each encoded file into the JSON.
  const bodyWithVariables = replaceQuotedPlaceholders(
    JSON.stringify(requestBody),
    filePlaceholders,
    ({ variableName }) => `"\${${variableName}}"`,
  );

  return [
    `curl -X POST ${requestUrl} \\`,
    ...headerLines,
    "  -d @- <<JSON",
    bodyWithVariables,
    "JSON",
  ].join("\n");
}

function buildLaravelSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headersPrefix =
    requestHeaders.length === 0
      ? "Http::"
      : `Http::withHeaders(${toPhpLiteral(toHeaderObject(requestHeaders))})->`;
  const bodyLiteral = toPhpLiteral(
    requestBody,
    0,
    buildVariableRenderer(filePlaceholders),
  );

  return `${headersPrefix}post("${requestUrl}", ${bodyLiteral});`;
}

function buildNodeSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headerEntries = [contentTypeHeader, ...requestHeaders].map(
    ({ headerName, headerValue }) =>
      `${JSON.stringify(headerName)}: ${JSON.stringify(headerValue)}`,
  );
  const indentedBody = replaceQuotedPlaceholders(
    JSON.stringify(requestBody, null, 2),
    filePlaceholders,
    ({ variableName }) => variableName,
  ).replaceAll("\n", "\n  ");

  return [
    `await fetch("${requestUrl}", {`,
    `  method: "POST",`,
    `  headers: { ${headerEntries.join(", ")} },`,
    `  body: JSON.stringify(${indentedBody}),`,
    `});`,
  ].join("\n");
}

function buildPythonSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const bodyLiteral = toPythonLiteral(
    requestBody,
    1,
    buildVariableRenderer(filePlaceholders),
  );
  const headersArgument =
    requestHeaders.length === 0
      ? ""
      : `,\n    headers=${toPythonLiteral(toHeaderObject(requestHeaders), 1)}`;

  return `requests.post(\n    "${requestUrl}",\n    json=${bodyLiteral}${headersArgument},\n)`;
}

function buildGoSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headerLines = [contentTypeHeader, ...requestHeaders].map(
    ({ headerName, headerValue }) =>
      `request.Header.Set(${JSON.stringify(headerName)}, ${JSON.stringify(headerValue)})`,
  );
  const bodyExpression = filePlaceholders.reduce(
    (jsonExpression, { placeholderText, variableName }) =>
      `strings.Replace(${jsonExpression}, ${JSON.stringify(placeholderText)}, ${variableName}, 1)`,
    "`" + JSON.stringify(requestBody, null, 2) + "`",
  );

  return [
    `body := strings.NewReader(${bodyExpression})`,
    `request, _ := http.NewRequest("POST", "${requestUrl}", body)`,
    ...headerLines,
    "response, err := http.DefaultClient.Do(request)",
  ].join("\n");
}

function buildJavaSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headerLines = [contentTypeHeader, ...requestHeaders].map(
    ({ headerName, headerValue }) =>
      `  .header(${JSON.stringify(headerName)}, ${JSON.stringify(headerValue)})`,
  );
  const indentedBody = JSON.stringify(requestBody, null, 2).replaceAll(
    "\n",
    "\n    ",
  );

  return [
    `HttpRequest.newBuilder(URI.create("${requestUrl}"))`,
    ...headerLines,
    `  .POST(BodyPublishers.ofString("""`,
    `    ${indentedBody}`,
    `    """${buildReplaceChain(filePlaceholders, "replace")}))`,
    `  .build();`,
  ].join("\n");
}

function buildRubySnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headerEntries = [contentTypeHeader, ...requestHeaders].map(
    ({ headerName, headerValue }) =>
      `${JSON.stringify(headerName)} => ${JSON.stringify(headerValue)}`,
  );
  const bodyLiteral = `'${JSON.stringify(requestBody).replaceAll("'", "\\'")}'`;

  return [
    `Net::HTTP.post(`,
    `  URI("${requestUrl}"),`,
    `  ${bodyLiteral}${buildReplaceChain(filePlaceholders, "sub")},`,
    `  { ${headerEntries.join(", ")} },`,
    `)`,
  ].join("\n");
}

function buildDotnetSnippet({
  requestUrl,
  requestHeaders,
  requestBody,
  filePlaceholders,
}: RenderedPostRequest) {
  const headerLines = requestHeaders.map(
    ({ headerName, headerValue }) =>
      `request.Headers.Add(${JSON.stringify(headerName)}, ${JSON.stringify(headerValue)});`,
  );
  const indentedBody = JSON.stringify(requestBody, null, 2).replaceAll(
    "\n",
    "\n        ",
  );

  return [
    `var request = new HttpRequestMessage(HttpMethod.Post, "${requestUrl}")`,
    `{`,
    `    Content = new StringContent("""`,
    `        ${indentedBody}`,
    `        """${buildReplaceChain(filePlaceholders, "Replace")}, Encoding.UTF8, "application/json"),`,
    `};`,
    ...headerLines,
    `var response = await httpClient.SendAsync(request);`,
  ].join("\n");
}

const postSnippetBuilders: Record<
  SnippetLanguage,
  (postRequest: RenderedPostRequest) => string
> = {
  laravel: buildLaravelSnippet,
  node: buildNodeSnippet,
  python: buildPythonSnippet,
  go: buildGoSnippet,
  java: buildJavaSnippet,
  ruby: buildRubySnippet,
  dotnet: buildDotnetSnippet,
  curl: buildCurlSnippet,
};

/**
 * A JSON POST with custom headers, written the way each language does it
 * (PL-05.7). `{{file:<name>}}` values become a file read and base64 encode
 * placed before the request (PL-05.8).
 */
export function buildHttpPostSnippet(
  language: SnippetLanguage,
  postRequest: PostRequest,
): string {
  const filePlaceholders = findFilePlaceholders(
    language,
    postRequest.requestBody,
  );
  const requestCode = postSnippetBuilders[language]({
    ...postRequest,
    filePlaceholders,
  });
  if (filePlaceholders.length === 0) {
    return requestCode;
  }

  const fileReadCode = filePlaceholders
    .map((filePlaceholder) => buildFileReadLines(language, filePlaceholder))
    .join("\n");

  return `${fileReadCode}\n\n${requestCode}`;
}
