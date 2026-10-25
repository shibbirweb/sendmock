import { answerPlaygroundRequest } from "@/mocks/playground-bridge/answer-playground-request";
import {
  type BridgeMessage,
  isPlaygroundRequest,
} from "@/mocks/playground-bridge/bridge-messages";
import { subscribeToMockEvents } from "@/mocks/realtime/mock-event-bus";
import { startMockApi } from "@/mocks/start-mock-api";

/**
 * The bridge runs in a hidden iframe on the website's API playground. It only
 * talks to a page on its own origin (the published site) or, while developing,
 * the website's dev server.
 */
function isTrustedOrigin(messageOrigin: string): boolean {
  return (
    messageOrigin === window.location.origin ||
    (import.meta.env.DEV && /^http:\/\/localhost:\d+$/.test(messageOrigin))
  );
}

async function startPlaygroundBridge() {
  await startMockApi({ hasLiveTraffic: false });
  let playgroundOrigin: string | null = null;
  const postToPlayground = (bridgeMessage: BridgeMessage) => {
    window.parent.postMessage(
      bridgeMessage,
      playgroundOrigin ?? window.location.origin,
    );
  };

  subscribeToMockEvents((appEvent) => {
    if (playgroundOrigin !== null) {
      postToPlayground({
        source: "sendmock-bridge",
        kind: "event",
        event: appEvent,
      });
    }
  });
  window.addEventListener("message", (messageEvent) => {
    if (
      !isTrustedOrigin(messageEvent.origin) ||
      !isPlaygroundRequest(messageEvent.data)
    ) {
      return;
    }
    playgroundOrigin = messageEvent.origin;
    const playgroundRequest = messageEvent.data;
    // A request the browser refuses to send still gets an answer, so the
    // playground never waits forever.
    void answerPlaygroundRequest(playgroundRequest)
      .catch((requestError: unknown) => ({
        source: "sendmock-bridge" as const,
        kind: "response" as const,
        requestId: playgroundRequest.requestId,
        status: 0,
        headers: {},
        body: `The browser could not send the request: ${String(requestError)}`,
        isBinary: false,
        durationMs: 0,
      }))
      .then(postToPlayground);
  });
  window.parent.postMessage(
    { source: "sendmock-bridge", kind: "ready" } satisfies BridgeMessage,
    "*",
  );
}

void startPlaygroundBridge();
