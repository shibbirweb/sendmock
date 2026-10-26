import { HttpHandler } from "msw";
import { setupWorker } from "msw/browser";

import { startMessageRules } from "@/mocks/automation/apply-message-rules";
import { registerMockRequestHandlers } from "@/mocks/automation/mock-request-dispatcher";
import { mockHandlers } from "@/mocks/handlers";
import { startMockEventGenerator } from "@/mocks/realtime/mock-event-generator";
import { startRuleFiring } from "@/mocks/webhooks/fire-matching-rules";

type MockApiOptions = {
  /** Random demo traffic every few seconds; the playground bridge turns it off. */
  hasLiveTraffic?: boolean;
};

/**
 * Starts the in-browser mock API. Every request to /api/v1 and the realtime
 * WebSocket are answered by the mock handlers, so the UI runs without a backend.
 */
export async function startMockApi({
  hasLiveTraffic = true,
}: MockApiOptions = {}) {
  const mockWorker = setupWorker(...mockHandlers);

  await mockWorker.start({
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
    },
    onUnhandledFrame: "bypass",
    quiet: true,
  });

  registerMockRequestHandlers(
    mockHandlers.filter(
      (mockHandler): mockHandler is HttpHandler =>
        mockHandler instanceof HttpHandler,
    ),
  );
  startRuleFiring();
  startMessageRules();
  if (hasLiveTraffic) {
    startMockEventGenerator();
  }
}
