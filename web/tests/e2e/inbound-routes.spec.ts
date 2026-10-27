import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

const routeRows = (page: Page) => page.getByTestId("inbound-route-row");

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/inbound-routes");
  await expect(routeRows(page)).toHaveCount(3);
});

test("WH-12.7 routes are listed by priority with their Mailgun expression and actions, and reorder", async ({
  page,
}) => {
  await expect(routeRows(page).first()).toContainText(
    'match_recipient("reply\\+(?P<token>[\\w-]+)@reply\\.app\\.test")',
  );
  await expect(routeRows(page).first()).toContainText("stop()");
  await expect(routeRows(page).last()).toContainText("catch_all()");
  await expect(
    page.getByRole("link", { name: "Inbound routes", exact: true }),
  ).toHaveAttribute("data-active", "true");

  await page
    .getByRole("button", { name: "Move Keep everything else up" })
    .click();
  await expect(routeRows(page).nth(1)).toContainText("Keep everything else");
  await expect(routeRows(page).last()).toContainText("Replies to no-reply");
});

test("WH-12.7 the editor previews matches with captured groups and flags bad patterns", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add route" }).click();
  const routeSheet = page.getByRole("dialog", { name: "Add route" });
  await routeSheet.getByLabel("Description").fill("Acme replies");
  await routeSheet.getByLabel("Pattern").fill("no-reply@(");
  await expect(
    routeSheet.getByText("Not a valid regular expression"),
  ).toBeVisible();

  await routeSheet.getByLabel("Pattern").fill("no-reply@(?P<domain>.+)");
  await expect(routeSheet.getByTestId("route-expression")).toHaveText(
    'match_recipient("no-reply@(?P<domain>.+)")',
  );
  await expect(routeSheet.getByTestId("route-match-count")).toHaveText(
    "Matches 1 of the last 1 incoming emails",
  );
  await expect(routeSheet.getByText("domain = acme.test")).toBeVisible();

  await routeSheet.getByRole("button", { name: "Add action" }).click();
  await page.getByRole("menuitem", { name: /^Stop/ }).click();
  await expect(
    routeSheet.getByRole("listitem", { name: "Action 2: Stop" }),
  ).toContainText("stop()");
  await routeSheet.getByRole("button", { name: "Add route" }).click();
  await expect(routeSheet).toBeHidden();
  await expect(routeRows(page)).toHaveCount(4);
  // Same priority as "Replies to no-reply": the older route runs first.
  await expect(routeRows(page).nth(2)).toContainText("Acme replies");

  await page.getByRole("button", { name: "Delete Acme replies" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(routeRows(page)).toHaveCount(3);
});

test("WH-12.7 an incoming email runs the matching routes, shown in its timeline and the delivery log", async ({
  page,
}) => {
  await navigateInApp(page, "/mail");
  await page
    .locator("section[aria-label='Email list']")
    .getByText("Your verification code", { exact: true })
    .click();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await composer.getByLabel("Message").fill("Got it, thanks.");
  await composer.getByRole("button", { name: "Send reply" }).click();
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Forwarded by route Replies to no-reply to http://localhost:8000/webhooks/mail/inbound (200)",
  );
  await expect(page.getByRole("tabpanel")).toContainText(
    "Stored and notified by route Keep everything else",
  );

  await navigateInApp(page, "/webhooks/deliveries");
  await expect(
    page.getByText("Route: Replies to no-reply").first(),
  ).toBeVisible();
});
