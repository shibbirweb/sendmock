/** A request as the playground form describes it, for a real SendMock instance. */
export type SnippetRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  /** JSON text, or null when the request has no body. */
  body: string | null;
};

export const snippetLanguages = [
  { key: "curl", label: "cURL" },
  { key: "php", label: "PHP" },
  { key: "javascript", label: "JavaScript" },
  { key: "python", label: "Python" },
  { key: "go", label: "Go" },
  { key: "java", label: "Java" },
  { key: "rust", label: "Rust" },
  { key: "ruby", label: "Ruby" },
  { key: "csharp", label: "C#" },
] as const;

export type SnippetLanguage = (typeof snippetLanguages)[number]["key"];

/** A string literal for languages that use double quotes and backslash escapes. */
function quote(text: string): string {
  return JSON.stringify(text);
}

function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function buildCurl({ method, url, headers, body }: SnippetRequest): string {
  const lines = [`curl -X ${method} ${shellQuote(url)}`];
  for (const [headerName, headerValue] of Object.entries(headers)) {
    lines.push(`  -H ${shellQuote(`${headerName}: ${headerValue}`)}`);
  }
  if (body !== null) {
    lines.push(`  -d ${shellQuote(body)}`);
  }
  return lines.join(" \\\n");
}

function buildPhp({ method, url, headers, body }: SnippetRequest): string {
  const options = [
    `    'headers' => [${Object.entries(headers)
      .map(
        ([headerName, headerValue]) =>
          `${quote(headerName)} => ${quote(headerValue)}`,
      )
      .join(", ")}],`,
    ...(body === null ? [] : [`    'body' => ${quote(body)},`]),
  ];
  return [
    "$client = new GuzzleHttp\\Client();",
    `$response = $client->request(${quote(method)}, ${quote(url)}, [`,
    ...options,
    "]);",
    "echo $response->getBody();",
  ].join("\n");
}

function buildJavaScript({
  method,
  url,
  headers,
  body,
}: SnippetRequest): string {
  const options = [
    `  method: ${quote(method)},`,
    `  headers: ${JSON.stringify(headers)},`,
    ...(body === null ? [] : [`  body: JSON.stringify(${body}),`]),
  ];
  return [
    `const response = await fetch(${quote(url)}, {`,
    ...options,
    "});",
    "console.log(response.status, await response.text());",
  ].join("\n");
}

function buildPython({ method, url, headers, body }: SnippetRequest): string {
  const bodyArgument = body === null ? "" : `,\n    data=${quote(body)}`;
  return [
    "import requests",
    "",
    "response = requests.request(",
    `    ${quote(method)},`,
    `    ${quote(url)},`,
    `    headers=${JSON.stringify(headers)}${bodyArgument},`,
    ")",
    "print(response.status_code, response.text)",
  ].join("\n");
}

function buildGo({ method, url, headers, body }: SnippetRequest): string {
  const bodyReader =
    body === null ? "nil" : `strings.NewReader(${quote(body)})`;
  return [
    `request, _ := http.NewRequest(${quote(method)}, ${quote(url)}, ${bodyReader})`,
    ...Object.entries(headers).map(
      ([headerName, headerValue]) =>
        `request.Header.Set(${quote(headerName)}, ${quote(headerValue)})`,
    ),
    "response, err := http.DefaultClient.Do(request)",
  ].join("\n");
}

function buildJava({ method, url, headers, body }: SnippetRequest): string {
  const publisher =
    body === null
      ? "HttpRequest.BodyPublishers.noBody()"
      : `HttpRequest.BodyPublishers.ofString(${quote(body)})`;
  return [
    `var request = HttpRequest.newBuilder(URI.create(${quote(url)}))`,
    ...Object.entries(headers).map(
      ([headerName, headerValue]) =>
        `    .header(${quote(headerName)}, ${quote(headerValue)})`,
    ),
    `    .method(${quote(method)}, ${publisher})`,
    "    .build();",
    "var response = HttpClient.newHttpClient()",
    "    .send(request, HttpResponse.BodyHandlers.ofString());",
  ].join("\n");
}

function buildRust({ method, url, headers, body }: SnippetRequest): string {
  return [
    "let response = reqwest::Client::new()",
    `    .request(reqwest::Method::${method}, ${quote(url)})`,
    ...Object.entries(headers).map(
      ([headerName, headerValue]) =>
        `    .header(${quote(headerName)}, ${quote(headerValue)})`,
    ),
    ...(body === null ? [] : [`    .body(${quote(body)})`]),
    "    .send()",
    "    .await?;",
  ].join("\n");
}

function buildRuby({ method, url, headers, body }: SnippetRequest): string {
  const requestClass = method.charAt(0) + method.slice(1).toLowerCase();
  return [
    'require "net/http"',
    "",
    `uri = URI(${quote(url)})`,
    `request = Net::HTTP::${requestClass}.new(uri)`,
    ...Object.entries(headers).map(
      ([headerName, headerValue]) =>
        `request[${quote(headerName)}] = ${quote(headerValue)}`,
    ),
    ...(body === null ? [] : [`request.body = ${quote(body)}`]),
    "response = Net::HTTP.start(uri.hostname, uri.port) { |http| http.request(request) }",
  ].join("\n");
}

function buildCsharp({ method, url, headers, body }: SnippetRequest): string {
  const contentType = headers["content-type"] ?? "application/json";
  return [
    "using var http = new HttpClient();",
    `var request = new HttpRequestMessage(new HttpMethod(${quote(method)}), ${quote(url)});`,
    ...Object.entries(headers)
      .filter(([headerName]) => headerName !== "content-type")
      .map(
        ([headerName, headerValue]) =>
          `request.Headers.Add(${quote(headerName)}, ${quote(headerValue)});`,
      ),
    ...(body === null
      ? []
      : [
          `request.Content = new StringContent(${quote(body)}, System.Text.Encoding.UTF8, ${quote(contentType)});`,
        ]),
    "var response = await http.SendAsync(request);",
  ].join("\n");
}

const snippetBuilders: Record<
  SnippetLanguage,
  (request: SnippetRequest) => string
> = {
  curl: buildCurl,
  php: buildPhp,
  javascript: buildJavaScript,
  python: buildPython,
  go: buildGo,
  java: buildJava,
  rust: buildRust,
  ruby: buildRuby,
  csharp: buildCsharp,
};

export function buildSnippet(
  snippetLanguage: SnippetLanguage,
  snippetRequest: SnippetRequest,
): string {
  return snippetBuilders[snippetLanguage](snippetRequest);
}
