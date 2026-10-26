import { type SurfaceCatalogue } from "./surface-definition";

/** The HTTP catcher: bins, their responses and captured requests. */
export const httpCatcherSurfaces: SurfaceCatalogue = {
  "GET /api/v1/http/bins": {
    cli: "sendmock http bin list",
    cliAliases: ["sendmock http bins"],
    mcp: "sendmock_http_bin_list",
    mcpAliases: ["sendmock_http_bins"],
    ui: "HTTP > bins",
  },
  "POST /api/v1/http/bins": {
    cli: "sendmock http bin create",
    mcp: "sendmock_http_bin_create",
    ui: "HTTP > New bin",
  },
  "PATCH /api/v1/http/bins/{binId}": {
    cli: "sendmock http bin update <binId>",
    mcp: "sendmock_http_bin_update",
    ui: "HTTP > bin > Responses > Edit default reply",
  },
  "DELETE /api/v1/http/bins/{binId}": {
    cli: "sendmock http bin delete <binId>",
    mcp: "sendmock_http_bin_delete",
    ui: "HTTP > bin > Delete bin",
  },
  "GET /api/v1/http/bins/{binId}/responses": {
    cli: "sendmock http response list <binId>",
    mcp: "sendmock_http_response_list",
    ui: "HTTP > bin > Responses",
  },
  "PUT /api/v1/http/bins/{binId}/responses": {
    cli: "sendmock http response set <binId>",
    mcp: "sendmock_http_response_set",
    ui: "HTTP > bin > Responses > Add rule, edit, move, enabled switch",
  },
  "POST /api/v1/http/bins/{binId}/responses/preview": {
    cli: "sendmock http response preview <binId>",
    mcp: "sendmock_http_response_preview",
    ui: "HTTP > bin > Responses > rule sheet > Preview",
  },
  "GET /api/v1/http/requests": {
    cli: "sendmock http list",
    mcp: "sendmock_http_list",
    ui: "HTTP > Requests",
  },
  "DELETE /api/v1/http/requests": {
    cli: "sendmock http clear",
    mcp: "sendmock_http_clear",
    ui: "HTTP > bin > Clear requests",
  },
  "GET /api/v1/http/requests/{requestId}": {
    cli: "sendmock http show <requestId>",
    mcp: "sendmock_http_get",
    ui: "HTTP > open a request",
  },
  "GET /api/v1/http/requests/{requestId}/files/{fileIndex}": {
    cli: "sendmock http file <requestId> <fileIndex>",
    mcp: "sendmock://http/requests/{requestId}/files/{fileIndex}",
    ui: "HTTP > request > Body > files",
  },
  "POST /api/v1/http/requests/{requestId}/forward": {
    cli: "sendmock http forward <requestId>",
    mcp: "sendmock_http_forward",
    ui: "HTTP > request > Forward to URL",
  },
  "GET /catch/{binPath}": {
    cli: "sendmock http send <bin>",
    mcp: "sendmock_http_send",
    ui: "HTTP > Send a sample request",
    selector: { input: "method", value: "GET" },
    cliArguments: { bin: "binPath" },
  },
  "POST /catch/{binPath}": {
    cli: "sendmock http send <bin>",
    mcp: "sendmock_http_send",
    ui: "HTTP > Send a sample request",
    selector: { input: "method", value: "POST" },
    cliArguments: { bin: "binPath" },
  },
  "PUT /catch/{binPath}": {
    cli: "sendmock http send <bin>",
    mcp: "sendmock_http_send",
    ui: "HTTP > Send a sample request",
    selector: { input: "method", value: "PUT" },
    cliArguments: { bin: "binPath" },
  },
  "PATCH /catch/{binPath}": {
    cli: "sendmock http send <bin>",
    mcp: "sendmock_http_send",
    ui: "HTTP > Send a sample request",
    selector: { input: "method", value: "PATCH" },
    cliArguments: { bin: "binPath" },
  },
  "DELETE /catch/{binPath}": {
    cli: "sendmock http send <bin>",
    mcp: "sendmock_http_send",
    ui: "HTTP > Send a sample request",
    selector: { input: "method", value: "DELETE" },
    cliArguments: { bin: "binPath" },
  },
};
