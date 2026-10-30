import type { PlaygroundRequest, PlaygroundResponse } from "./bridge-messages";

/** Where the playground sends requests: the in-browser demo, or a real SendMock. */
export type PlaygroundTarget =
  | { kind: "demo" }
  | { kind: "instance"; baseUrl: string; apiToken: string | null };

export type ConnectionProblem =
  "unreachable" | "cors" | "unauthorized" | "not-sendmock";

export type ConnectionOutcome =
  | { kind: "connected"; version: string }
  | { kind: "failed"; problem: ConnectionProblem };

/** The default address of a SendMock on this machine. */
export const localInstanceUrl = "http://localhost:8025";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function buildHeaders(
  requestHeaders: Record<string, string>,
  apiToken: string | null,
): Record<string, string> {
  return apiToken === null || apiToken === ""
    ? requestHeaders
    : { ...requestHeaders, authorization: `Bearer ${apiToken}` };
}

/** Sends one playground request to a SendMock and reads the answer like the demo bridge does. */
export async function sendToInstance(
  baseUrl: string,
  apiToken: string | null,
  playgroundRequest: PlaygroundRequest,
): Promise<PlaygroundResponse> {
  const startedAtMs = performance.now();
  const response = await fetch(joinUrl(baseUrl, playgroundRequest.path), {
    method: playgroundRequest.method,
    headers: buildHeaders(playgroundRequest.headers, apiToken),
    body: playgroundRequest.body,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const isBinary =
    !/json|text|xml|event-stream/.test(contentType) && contentType !== "";

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: isBinary
      ? `(${(await response.arrayBuffer()).byteLength} bytes)`
      : await response.text(),
    isBinary,
    durationMs: Math.round(performance.now() - startedAtMs),
  };
}

/**
 * Asks the SendMock at `baseUrl` for `/api/v1/info`, only after the user clicks Connect
 * (WS-05.2). A failed fetch is retried without CORS to tell a server that refuses this
 * site from one that cannot be reached at all (WS-05.3).
 */
export async function connectToInstance(
  baseUrl: string,
  apiToken: string | null,
): Promise<ConnectionOutcome> {
  try {
    const infoResponse = await fetch(joinUrl(baseUrl, "/api/v1/info"), {
      headers: buildHeaders({ accept: "application/json" }, apiToken),
    });
    if (infoResponse.status === 401) {
      return { kind: "failed", problem: "unauthorized" };
    }
    const appInfo = (await infoResponse.json().catch(() => null)) as {
      version?: unknown;
    } | null;
    return typeof appInfo?.version === "string"
      ? { kind: "connected", version: appInfo.version }
      : { kind: "failed", problem: "not-sendmock" };
  } catch {
    const isReachable = await fetch(joinUrl(baseUrl, "/api/v1/health"), {
      mode: "no-cors",
    })
      .then(() => true)
      .catch(() => false);
    return { kind: "failed", problem: isReachable ? "cors" : "unreachable" };
  }
}

/** What went wrong and how to fix it, in the words the playground shows. */
export function describeConnectionProblem(
  problem: ConnectionProblem,
  baseUrl: string,
): string {
  switch (problem) {
    case "unreachable":
      return `Could not reach SendMock at ${baseUrl}. Start it with \`sendmock\` and check the address. If it is running, your browser may have blocked this page from reaching your local network: allow local network access when the browser asks, or in the site settings.`;
    case "cors":
      return `SendMock at ${baseUrl} is running but does not allow requests from this site. Start it without --cors-origins, or add this site's origin to it.`;
    case "unauthorized":
      return `SendMock at ${baseUrl} has UI auth on. Paste its API token (--api-token) and connect again.`;
    case "not-sendmock":
      return `${baseUrl} answered, but not like SendMock. Check the address and port.`;
  }
}
