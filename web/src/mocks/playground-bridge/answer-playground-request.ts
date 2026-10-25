import type {
  BridgeMessage,
  PlaygroundRequestMessage,
} from "@/mocks/playground-bridge/bridge-messages";

const textContentTypePattern = /json|text|xml|toml|x-www-form-urlencoded/;

/**
 * Sends the playground's request through fetch, so the mock service worker
 * answers it exactly as it answers the demo app. Paths resolve against the
 * bridge's folder (`/demo/`), which the handlers' wildcard prefix matches.
 */
export async function answerPlaygroundRequest(
  playgroundRequest: PlaygroundRequestMessage,
): Promise<Extract<BridgeMessage, { kind: "response" }>> {
  const requestUrl = new URL(
    playgroundRequest.path.replace(/^\//, ""),
    document.baseURI,
  );
  const startedAtMs = performance.now();
  const response = await fetch(requestUrl, {
    method: playgroundRequest.method,
    headers: playgroundRequest.headers,
    body: playgroundRequest.body,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const isBinary =
    contentType !== "" && !textContentTypePattern.test(contentType);
  const body = isBinary
    ? `${(await response.arrayBuffer()).byteLength} bytes of ${contentType}`
    : await response.text();

  return {
    source: "sendmock-bridge",
    kind: "response",
    requestId: playgroundRequest.requestId,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    isBinary,
    durationMs: Math.round(performance.now() - startedAtMs),
  };
}
