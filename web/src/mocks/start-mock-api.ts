import { setupWorker } from "msw/browser";

import { mockHandlers } from "@/mocks/handlers";
import { startMockEventGenerator } from "@/mocks/realtime/mock-event-generator";
import { startRuleFiring } from "@/mocks/webhooks/fire-matching-rules";

/**
 * Starts the in-browser mock API. Every request to /api/v1 and the realtime
 * WebSocket are answered by the mock handlers, so the UI runs without a backend.
 */
export async function startMockApi() {
  const mockWorker = setupWorker(...mockHandlers);

  await mockWorker.start({
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
    },
    onUnhandledFrame: "bypass",
    quiet: true,
  });

  startRuleFiring();
  startMockEventGenerator();
}
