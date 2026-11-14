import type {
  CapturedHttpRequest,
  HttpMockResponse,
  WebhookVariable,
} from "@/lib/api/types";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

function parseJsonBody(bodyText: string): unknown {
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return null;
  }
}

/** What a response template reads: `request.*`, global `vars` and `sendmock` (HC-02.2). */
export function buildResponseContext(
  capturedRequest: CapturedHttpRequest,
  webhookVariables: WebhookVariable[],
): TemplateContext {
  return {
    request: {
      method: capturedRequest.method,
      url: capturedRequest.url,
      path: capturedRequest.path,
      query: capturedRequest.query,
      headers: capturedRequest.headers,
      body: capturedRequest.body,
      json: parseJsonBody(capturedRequest.body),
    },
    vars: Object.fromEntries(
      webhookVariables
        .filter((webhookVariable) => webhookVariable.scope === "global")
        .map((webhookVariable) => [
          webhookVariable.name,
          webhookVariable.value,
        ]),
    ),
    sendmock: { version: "0.0.0-dev", http_url: "http://127.0.0.1:8025" },
  };
}

/** A mock reply with its header and body templates rendered, and any problems. */
export function renderMockResponse(
  mockResponse: HttpMockResponse,
  templateContext: TemplateContext,
): { response: HttpMockResponse; problems: string[] } {
  const problems: string[] = [];
  const renderPart = (templateText: string) => {
    const renderOutcome = renderTemplateText(templateText, templateContext);
    problems.push(...renderOutcome.errors, ...renderOutcome.warnings);
    return renderOutcome.renderedText;
  };
  const renderedHeaders = Object.fromEntries(
    Object.entries(mockResponse.headers).map(([headerName, headerTemplate]) => [
      headerName,
      renderPart(headerTemplate),
    ]),
  );

  return {
    response: {
      status_code: mockResponse.status_code,
      headers: renderedHeaders,
      body: renderPart(mockResponse.body),
    },
    problems: [...new Set(problems)],
  };
}
