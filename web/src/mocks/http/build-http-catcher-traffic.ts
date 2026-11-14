import type {
  CapturedHttpRequest,
  HttpBin,
  HttpResponseRule,
  WebhookVariable,
} from "@/lib/api/types";
import {
  buildCapturedHttpRequestFixtures,
  fixtureFileContents,
} from "@/mocks/fixtures/http-catcher-fixtures";
import {
  buildResponseContext,
  renderMockResponse,
} from "@/mocks/http/render-mock-response";

/** Bins with their request count and last request time, from the requests. */
export function countBinRequests(
  httpBins: HttpBin[],
  capturedRequests: CapturedHttpRequest[],
): HttpBin[] {
  return httpBins.map((httpBin) => {
    const binRequests = capturedRequests.filter(
      (capturedRequest) => capturedRequest.bin_id === httpBin.id,
    );

    return {
      ...httpBin,
      request_count: binRequests.length,
      last_request_at:
        binRequests
          .map((capturedRequest) => capturedRequest.created_at)
          .sort()
          .at(-1) ?? null,
    };
  });
}

/** The fixture requests with rendered replies, their uploaded files and the bin counts. */
export function buildHttpCatcherTraffic(
  httpBins: HttpBin[],
  responseRulesByBinId: Map<string, HttpResponseRule[]>,
  webhookVariables: WebhookVariable[],
) {
  const responseRulesByBinName = Object.fromEntries(
    httpBins.map((httpBin) => [
      httpBin.name,
      responseRulesByBinId.get(httpBin.id) ?? [],
    ]),
  );
  const capturedRequests = buildCapturedHttpRequestFixtures(
    httpBins,
    responseRulesByBinName,
  ).map((capturedRequest) => {
    const { response } = renderMockResponse(
      {
        status_code: capturedRequest.response_status,
        headers: capturedRequest.response_headers,
        body: capturedRequest.response_body,
      },
      buildResponseContext(capturedRequest, webhookVariables),
    );

    return {
      ...capturedRequest,
      response_headers: response.headers,
      response_body: response.body,
    };
  });
  const fileContents = new Map(
    capturedRequests.flatMap((capturedRequest) =>
      capturedRequest.files.map((capturedFile) => [
        `${capturedRequest.id}:${capturedFile.file_index}`,
        fixtureFileContents[capturedFile.filename] ?? "",
      ]),
    ),
  );

  return {
    capturedRequests,
    fileContents,
    httpBins: countBinRequests(httpBins, capturedRequests),
  };
}
