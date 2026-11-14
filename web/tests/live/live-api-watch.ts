import type { Page } from "@playwright/test";

/** Every API call that failed while a test ran, as `STATUS METHOD path`. */
export function watchFailedApiCalls(page: Page): string[] {
  const failedApiCalls: string[] = [];
  page.on("response", (response) => {
    const requestUrl = new URL(response.url());
    if (requestUrl.pathname.startsWith("/api/") && response.status() >= 400) {
      failedApiCalls.push(
        `${response.status()} ${response.request().method()} ${requestUrl.pathname}`,
      );
    }
  });

  return failedApiCalls;
}
