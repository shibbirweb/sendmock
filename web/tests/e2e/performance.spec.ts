import { expect, test } from "@playwright/test";

const emailList = "section[aria-label='Email list']";
const mailRowHeightPx = 84;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/mail");
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByLabel("Data set").click();
  await page.getByRole("option", { name: /Large/ }).click();
  // No simulated network delay: the budget is for the UI's own work.
  await page.getByRole("slider", { name: "Latency" }).press("Home");
  await page.keyboard.press("Escape");
  // The standard list stays on screen until the large one has loaded.
  await expect(page.getByText(/^5,?0\d\d emails$/)).toBeVisible();
});

test("UI-06.2 with 5,000 emails the list keeps only the visible rows in the page", async ({
  page,
}) => {
  const emailLinks = page.locator(emailList).getByRole("link");
  const maximumRenderedRows = Math.ceil(900 / mailRowHeightPx) + 20;
  const firstEmailHref = await emailLinks.first().getAttribute("href");
  expect(await emailLinks.count()).toBeLessThan(maximumRenderedRows);

  await emailLinks.first().hover();
  for (let scrollStep = 0; scrollStep < 6; scrollStep += 1) {
    await page.mouse.wheel(0, 40 * mailRowHeightPx);
    await page.waitForTimeout(150);
  }

  // The rows scrolled past have left the page; the count stays small.
  await expect(emailLinks.first()).not.toHaveAttribute(
    "href",
    firstEmailHref ?? "",
  );
  expect(await emailLinks.count()).toBeLessThan(maximumRenderedRows);
});

test("UI-06.2 with 5,000 emails an email opens in under 200 ms", async ({
  page,
}) => {
  const openDurationsMs: number[] = [];

  for (const rowIndex of [2, 5, 8]) {
    const openDurationMs = await page.evaluate(
      async ({ listSelector, linkIndex }) => {
        const emailLink = document
          .querySelector(listSelector)
          ?.querySelectorAll("a")
          .item(linkIndex);
        if (emailLink === undefined || emailLink === null) {
          throw new Error(`No email row ${linkIndex}`);
        }
        const emailHref = emailLink.getAttribute("href") ?? "";
        const clickedAtMs = performance.now();
        emailLink.click();

        return new Promise<number>((resolve) => {
          const waitForDetail = () => {
            const isDetailShown =
              window.location.href.includes(emailHref.split("?")[0] ?? "") &&
              document.querySelector("main h2") !== null &&
              document.querySelector("[role='tabpanel']") !== null;
            if (isDetailShown) {
              resolve(performance.now() - clickedAtMs);
              return;
            }
            requestAnimationFrame(waitForDetail);
          };
          waitForDetail();
        });
      },
      { listSelector: emailList, linkIndex: rowIndex },
    );
    openDurationsMs.push(openDurationMs);
  }

  // The median of three, so one slow frame on a busy machine does not decide it.
  const medianOpenDurationMs = [...openDurationsMs].sort(
    (firstDuration, secondDuration) => firstDuration - secondDuration,
  )[1];
  expect(medianOpenDurationMs).toBeLessThan(200);
});
