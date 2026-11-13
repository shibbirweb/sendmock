import { type Page, expect, test } from "@playwright/test";

import { sendBurstOverSmtp } from "./live-smtp";

const burstSize = 5000;
const keepUpBudgetMs = 2000;
const maxListRequestsPerSecond = 4;
const toastIntervalMs = 2000;
/** Timers in the page fire a little early or late; the limiter's gap is 2 seconds. */
const toastTimingSlackMs = 150;

type ListRequest = {
  startedAtMs: number;
  isFirstPage: boolean;
  isAborted: boolean;
};
type ShownToast = { shownAtMs: number; text: string };

/** Records every request for an email list page (not one email) and whether it was cancelled. */
function watchEmailListRequests(page: Page): ListRequest[] {
  const listRequests: ListRequest[] = [];
  const requestRecords = new Map<object, ListRequest>();
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (
      request.method() === "GET" &&
      requestUrl.pathname === "/api/v1/emails"
    ) {
      const listRequest = {
        startedAtMs: Date.now(),
        isFirstPage: !requestUrl.searchParams.has("cursor"),
        isAborted: false,
      };
      requestRecords.set(request, listRequest);
      listRequests.push(listRequest);
    }
  });
  page.on("requestfailed", (request) => {
    const listRequest = requestRecords.get(request);
    if (listRequest !== undefined) {
      listRequest.isAborted = true;
    }
  });

  return listRequests;
}

/**
 * The most times the page asked for a list within any one second: each ask starts with the
 * first page, and a refresh of a scrolling list then fetches its later pages too.
 */
function countBusiestSecond(listRequests: ListRequest[]): number {
  const firstPageRequests = listRequests.filter(
    (listRequest) => listRequest.isFirstPage,
  );
  return firstPageRequests.reduce((busiestCount, listRequest) => {
    const requestsInSecond = firstPageRequests.filter(
      (otherRequest) =>
        otherRequest.startedAtMs >= listRequest.startedAtMs &&
        otherRequest.startedAtMs < listRequest.startedAtMs + 1000,
    ).length;
    return Math.max(busiestCount, requestsInSecond);
  }, 0);
}

/** Records every toast the page shows, with when it appeared. */
async function recordShownToasts(page: Page) {
  await page.addInitScript(() => {
    const shownToasts: { shownAtMs: number; text: string }[] = [];
    Object.assign(window, { shownToasts });
    new MutationObserver((mutationRecords) => {
      for (const mutationRecord of mutationRecords) {
        for (const addedNode of mutationRecord.addedNodes) {
          if (
            addedNode instanceof HTMLElement &&
            addedNode.matches("[data-sonner-toast]")
          ) {
            shownToasts.push({
              shownAtMs: Date.now(),
              text: addedNode.textContent ?? "",
            });
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  return () =>
    page.evaluate(
      () => (window as unknown as { shownToasts: ShownToast[] }).shownToasts,
    );
}

function burstRowPattern(burstLabel: string): RegExp {
  return new RegExp(`^${burstLabel} \\d+$`);
}

/** The burst number of the newest burst email the list shows at the top, or 0. */
async function readTopBurstNumber(page: Page, burstLabel: string) {
  const topBurstRow = page.getByText(burstRowPattern(burstLabel)).first();
  if ((await topBurstRow.count()) === 0) {
    return 0;
  }
  const rowText = (await topBurstRow.textContent()) ?? "";

  return Number(rowText.split(" ").at(-1));
}

let maxEmailsBefore: number | null = null;

// Retention keeps the newest 1,000 emails by default, so a sweep during the burst would lower the
// count this test waits for. This test is about keeping up with arrivals, so it runs with
// retention off.
test.beforeAll(async ({ request }) => {
  const { max_emails: maxEmails } = await (
    await request.get("/api/v1/settings")
  ).json();
  maxEmailsBefore = maxEmails ?? null;
  await request.patch("/api/v1/settings", { data: { max_emails: 0 } });
});

test.afterAll(async ({ request }) => {
  await request.delete("/api/v1/emails");
  if (maxEmailsBefore !== null) {
    await request.patch("/api/v1/settings", {
      data: { max_emails: maxEmailsBefore },
    });
  }
});

test("PL-02.3 PL-02.4 while 5,000 emails arrive the list keeps up, asks at most 4 times a second, and the page stays usable", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const burstLabel = `Burst ${Date.now()}`;
  const { smtp_address: smtpAddress } = await (
    await request.get("/api/v1/info")
  ).json();
  const { total_count: emailCountBefore } = await (
    await request.get("/api/v1/emails?limit=1")
  ).json();
  const readShownToasts = await recordShownToasts(page);
  await page.goto("/mail");
  await expect(
    page.getByText(`${emailCountBefore} emails`, { exact: true }),
  ).toBeVisible();
  const listRequests = watchEmailListRequests(page);

  const checkpointChecks: Promise<void>[] = [];
  await sendBurstOverSmtp(
    smtpAddress,
    burstSize,
    (messageNumber) => `${burstLabel} ${messageNumber}`,
    (messageNumber) => {
      if (messageNumber === 1000 || messageNumber === 2500) {
        checkpointChecks.push(
          expect
            .poll(() => readTopBurstNumber(page, burstLabel), {
              timeout: keepUpBudgetMs,
            })
            .toBeGreaterThanOrEqual(messageNumber),
        );
      }
      if (messageNumber === 2500) {
        // Rows move down with every flush, so the test opens whichever burst email is on
        // top and checks that a burst email opens in time.
        checkpointChecks.push(
          (async () => {
            await page
              .getByText(burstRowPattern(burstLabel))
              .first()
              .click({ timeout: keepUpBudgetMs });
            await expect(
              page.getByRole("heading", {
                level: 2,
                name: burstRowPattern(burstLabel),
              }),
            ).toBeVisible({ timeout: keepUpBudgetMs });
          })(),
        );
      }
    },
  );
  await Promise.all(checkpointChecks);

  const { unread_email_count: unreadEmailCount } = await (
    await request.get("/api/v1/stats")
  ).json();
  await expect(
    page.getByText(`${emailCountBefore + burstSize} emails`),
  ).toBeVisible({ timeout: keepUpBudgetMs });
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: /^Mail/ }) })
      .locator('[data-sidebar="menu-badge"]'),
  ).toHaveText(String(unreadEmailCount), { timeout: keepUpBudgetMs });
  await expect
    .poll(() => readTopBurstNumber(page, burstLabel), {
      timeout: keepUpBudgetMs,
    })
    .toBe(burstSize);

  expect(countBusiestSecond(listRequests)).toBeLessThanOrEqual(
    maxListRequestsPerSecond,
  );
  expect(listRequests.filter((listRequest) => listRequest.isAborted)).toEqual(
    [],
  );

  const shownToasts = await readShownToasts();
  const toastGapsMs = shownToasts
    .slice(1)
    .map(
      (shownToast, toastIndex) =>
        shownToast.shownAtMs - (shownToasts[toastIndex]?.shownAtMs ?? 0),
    );
  expect(shownToasts.length).toBeGreaterThan(1);
  expect(
    toastGapsMs.every(
      (toastGapMs) => toastGapMs >= toastIntervalMs - toastTimingSlackMs,
    ),
  ).toBe(true);
  expect(shownToasts.some((shownToast) => /more\)/.test(shownToast.text))).toBe(
    true,
  );
});
