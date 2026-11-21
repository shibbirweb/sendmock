import type { Page } from "@playwright/test";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function toUtcIsoDate(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

/**
 * Answers the footer wordmark's live requests to npm and crates.io, so no test reaches a real
 * registry: with downloads on the last two days, or as a failed request. Registered routes
 * stack, so a later call takes over from an earlier one.
 */
export async function mockDownloadRegistries(
  page: Page,
  { isFailing = false }: { isFailing?: boolean } = {},
) {
  const now = Date.now();
  const yesterday = toUtcIsoDate(new Date(now - millisecondsPerDay));
  const dayBeforeYesterday = toUtcIsoDate(
    new Date(now - 2 * millisecondsPerDay),
  );
  const requestedHosts: string[] = [];

  await page.route("https://api.npmjs.org/**", async (route) => {
    requestedHosts.push("api.npmjs.org");
    if (isFailing) {
      await route.abort();
      return;
    }
    await route.fulfill({
      json: {
        sendmock: {
          downloads: [
            { day: dayBeforeYesterday, downloads: 50 },
            { day: yesterday, downloads: 100 },
          ],
        },
        "sendmock-testcontainers": null,
      },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.route("https://crates.io/**", async (route) => {
    requestedHosts.push("crates.io");
    if (isFailing) {
      await route.abort();
      return;
    }
    await route.fulfill({
      json: {
        version_downloads: [{ version: 1, downloads: 20, date: yesterday }],
        meta: { extra_downloads: [] },
      },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });

  return {
    yesterday,
    dayBeforeYesterday,
    requestedHosts: () => [...requestedHosts],
  };
}
