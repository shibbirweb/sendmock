import { setupWorker } from "msw/browser";

import { mockHandlers } from "@/mocks/handlers";

/**
 * Starts the in-browser mock API. Every request to /api/v1 is answered by the
 * mock handlers, so the UI runs without a backend.
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
}
