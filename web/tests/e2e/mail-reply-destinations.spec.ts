import { expect, type Page, test } from "@playwright/test";
import { clickToastAction } from "./support/toasts";

const emailList = "section[aria-label='Email list']";
// The demo email "Your verification code" was sent from no-reply@acme.test.
const originalSubject = "Your verification code";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

async function openOriginal(page: Page) {
  await page
    .locator(emailList)
    .getByText(originalSubject, { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: originalSubject }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/mail");
  await openOriginal(page);
});

test("EM-22.1 a reply sends as prefilled, and with an empty message box", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await expect(
    composer.getByRole("button", { name: "Send reply" }),
  ).toBeEnabled();
  await composer.getByRole("button", { name: "Send reply" }).click();
  await clickToastAction(page, "Reply created", "Open");
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "> Verify your account",
  );

  await navigateInApp(page, "/mail");
  await openOriginal(page);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await composer.getByLabel("Message").fill("");
  await composer.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Reply created" }).last(),
  ).toBeVisible();
});

test("EM-22.3 Delivers to lists each route target and follows the Forward address", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const deliversTo = page.getByRole("group", { name: "Delivers to" });
  await expect(deliversTo).toContainText(
    "http://localhost:8000/webhooks/mail/inbound",
  );
  await expect(deliversTo).toContainText("Route Replies to no-reply");
  await expect(deliversTo).toContainText(
    "http://localhost:8000/webhooks/mail/stored",
  );
  await page.getByRole("button", { name: "Close composer" }).click();

  await page.getByRole("button", { name: "Forward", exact: true }).click();
  const composer = page.getByRole("region", { name: "Forward as recipient" });
  await expect(deliversTo).toBeHidden();
  await composer.getByLabel("To").fill("reply+T-9@reply.app.test");
  await expect(deliversTo).toContainText(
    "http://localhost:8000/webhooks/mail/tickets/T-9",
  );
  // The ticket route calls stop(), so the catch-all never runs.
  await expect(deliversTo).not.toContainText("stored");

  await deliversTo.getByRole("link", { name: /tickets\/T-9/ }).click();
  await expect(page.getByRole("dialog", { name: "Edit route" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Edit route" }).getByLabel("Description"),
  ).toHaveValue("Ticket replies to Laravel");
});

test("EM-22.4 with nothing to receive it, Send replies to your app creates the route", async ({
  page,
}) => {
  await navigateInApp(page, "/webhooks/inbound-routes");
  for (const routeName of ["Keep everything else", "Replies to no-reply"]) {
    await page.getByRole("button", { name: `Delete ${routeName}` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
  }
  await expect(page.getByTestId("inbound-route-row")).toHaveCount(1);
  await navigateInApp(page, "/mail");
  await openOriginal(page);

  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const deliversTo = page.getByRole("group", { name: "Delivers to" });
  await expect(deliversTo).toContainText("Nothing receives this yet");
  await deliversTo
    .getByRole("button", { name: "Send replies to your app" })
    .click();
  const quickRoute = page.getByRole("group", {
    name: "Send replies to your app",
  });
  await expect(
    quickRoute.getByLabel("Only mail to no-reply@acme.test"),
  ).toBeChecked();
  await quickRoute.getByRole("button", { name: "Create route" }).click();
  await expect(quickRoute.getByText("Enter your app's URL")).toBeVisible();
  await quickRoute
    .getByLabel("Your app's URL")
    .fill("http://localhost:8000/webhooks/mail");
  await quickRoute.getByRole("button", { name: "Create route" }).click();

  await expect(quickRoute).toBeHidden();
  await expect(deliversTo).toContainText("http://localhost:8000/webhooks/mail");
  await expect(deliversTo).toContainText(
    "Route Mail to no-reply@acme.test to my app",
  );
  await navigateInApp(page, "/webhooks/inbound-routes");
  await expect(page.getByTestId("inbound-route-row")).toHaveCount(2);
  await expect(page.getByTestId("inbound-route-row").last()).toContainText(
    'match_recipient("^no-reply@acme\\.test$")',
  );
});

test("EM-22.5 the toast and the incoming email list each webhook request, linked to its delivery", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("region", { name: "Reply as recipient" });
  await composer.getByRole("button", { name: "Send reply" }).click();

  const sentToast = page.locator("[data-sonner-toast]", {
    hasText: "Reply created",
  });
  await expect(sentToast).toContainText(
    "http://localhost:8000/webhooks/mail/inbound",
  );
  await expect(sentToast).toContainText("200");
  await clickToastAction(page, "Reply created", "Open");
  const requests = page.getByRole("list", { name: "Webhook requests" });
  await expect(requests.getByRole("listitem")).toHaveCount(2);
  await requests
    .getByRole("link", { name: "http://localhost:8000/webhooks/mail/inbound" })
    .click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=/);
});
