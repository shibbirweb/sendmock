import {
  type ApiEndpoint,
  type AreaEndpoint,
  type HttpMethodName,
  fileOf,
  listOf,
  pageOf,
  pageQueryParameters,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const binIdQueryParameter = {
  name: "bin_id",
  description: "Only this bin.",
  schema: "string",
} as const;

/** The capture URL apps call: any method, the bin name, then any path. */
const captureMethods: HttpMethodName[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

const captureEndpoints: AreaEndpoint[] = captureMethods.map((method) => ({
  method,
  path: "/catch/{binPath}",
  summary:
    "Capture a request in a bin and answer with its matching response rule or default response.",
  // GET and DELETE carry no body.
  ...(method === "GET" || method === "DELETE"
    ? {}
    : { requestBody: fileOf("*/*") }),
  response: fileOf("*/*"),
}));

export const httpCatcherApi: ApiEndpoint[] = tagEndpoints("HTTP catcher", [
  {
    method: "GET",
    path: "/api/v1/http/bins",
    summary: "Bins, each a capture URL with its own responses.",
    response: listOf("HttpBin"),
  },
  {
    method: "POST",
    path: "/api/v1/http/bins",
    summary: "Add a bin; 409 when the name is taken.",
    requestBody: typeRef("HttpBinInput"),
    response: typeRef("HttpBin"),
    successStatus: 201,
    errorStatuses: [400, 409],
  },
  {
    method: "PATCH",
    path: "/api/v1/http/bins/{binId}",
    summary: "Change a bin's default response.",
    requestBody: typeRef("HttpBinUpdate"),
    response: typeRef("HttpBin"),
    errorStatuses: [404],
  },
  {
    method: "DELETE",
    path: "/api/v1/http/bins/{binId}",
    summary: "Delete a bin and its requests.",
    response: null,
    successStatus: 204,
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/http/bins/{binId}/responses",
    summary: "A bin's response rules, checked from top to bottom.",
    response: listOf("HttpResponseRule"),
    errorStatuses: [404],
  },
  {
    method: "PUT",
    path: "/api/v1/http/bins/{binId}/responses",
    summary: "Replace a bin's response rules.",
    requestBody: listOf("HttpResponseRule"),
    response: listOf("HttpResponseRule"),
    errorStatuses: [400, 404],
  },
  {
    method: "POST",
    path: "/api/v1/http/bins/{binId}/responses/preview",
    summary: "Which rule a captured request would match, and its answer.",
    requestBody: typeRef("HttpRulePreviewRequest"),
    response: typeRef("HttpRulePreviewResult"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/http/requests",
    summary: "Captured requests, newest first.",
    queryParameters: [...pageQueryParameters, binIdQueryParameter],
    response: pageOf("CapturedHttpRequest"),
  },
  {
    method: "DELETE",
    path: "/api/v1/http/requests",
    summary: "Delete captured requests, all or one bin's.",
    queryParameters: [binIdQueryParameter],
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/http/requests/{requestId}",
    summary: "One captured request and what SendMock answered.",
    response: typeRef("CapturedHttpRequest"),
    errorStatuses: [404],
  },
  {
    method: "GET",
    path: "/api/v1/http/requests/{requestId}/files/{fileIndex}",
    summary: "Download a file uploaded in a captured request.",
    response: fileOf("application/octet-stream"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/http/requests/{requestId}/forward",
    summary: "Send a captured request on to another URL.",
    requestBody: typeRef("HttpForwardRequest"),
    response: typeRef("HttpForwardResult"),
    errorStatuses: [400, 404],
  },
  ...captureEndpoints,
]);
