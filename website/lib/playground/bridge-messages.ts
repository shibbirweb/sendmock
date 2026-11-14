/**
 * A copy of web/src/mocks/playground-bridge/bridge-messages.ts: the messages
 * between this playground and the demo app's bridge page, which answers with
 * the same mock API as the demo.
 */
export type PlaygroundRequest = {
  method: string;
  /** Path and query, e.g. `/api/v1/emails?limit=5`. */
  path: string;
  headers: Record<string, string>;
  body: string | null;
};

export type PlaygroundResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  isBinary: boolean;
  durationMs: number;
};

export type PlaygroundEvent = {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
};

export type BridgeMessage =
  | { source: "sendmock-bridge"; kind: "ready" }
  | ({
      source: "sendmock-bridge";
      kind: "response";
      requestId: string;
    } & PlaygroundResponse)
  | { source: "sendmock-bridge"; kind: "event"; event: PlaygroundEvent };

export function isBridgeMessage(
  messageData: unknown,
): messageData is BridgeMessage {
  return (
    typeof messageData === "object" &&
    messageData !== null &&
    (messageData as BridgeMessage).source === "sendmock-bridge"
  );
}

/**
 * The bridge page of the demo app: next to the site in production, the web
 * app's dev server while developing (override with NEXT_PUBLIC_DEMO_URL).
 */
export function readBridgeUrl(basePath: string): string {
  const demoUrl =
    process.env.NEXT_PUBLIC_DEMO_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:5173/"
      : `${basePath}/demo/`);

  return `${demoUrl}playground-bridge.html`;
}
