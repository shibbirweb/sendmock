import type { AppEvent } from "@/lib/api/types";

/**
 * Messages between the website's API playground and this bridge page, which
 * answers the playground's requests with the same mock API as the demo
 * (docs/plan/18-phase-u3.md, W10). The website keeps a copy of these shapes.
 */
export type PlaygroundRequestMessage = {
  source: "sendmock-playground";
  kind: "request";
  requestId: string;
  method: string;
  /** Path and query, e.g. `/api/v1/emails?limit=5`. */
  path: string;
  headers: Record<string, string>;
  body: string | null;
};

export type BridgeMessage =
  | { source: "sendmock-bridge"; kind: "ready" }
  | {
      source: "sendmock-bridge";
      kind: "response";
      requestId: string;
      status: number;
      headers: Record<string, string>;
      body: string;
      isBinary: boolean;
      durationMs: number;
    }
  | { source: "sendmock-bridge"; kind: "event"; event: AppEvent };

export function isPlaygroundRequest(
  messageData: unknown,
): messageData is PlaygroundRequestMessage {
  return (
    typeof messageData === "object" &&
    messageData !== null &&
    (messageData as PlaygroundRequestMessage).source ===
      "sendmock-playground" &&
    (messageData as PlaygroundRequestMessage).kind === "request"
  );
}
