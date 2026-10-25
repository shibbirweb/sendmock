import { expect, type Page, test } from "@playwright/test";

async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}

/** Opens a payment's checkout page without reloading, so the mock data stays. */
async function openCheckout(page: Page, customerName: string) {
  await page.goto("/payments");
  const paymentLink = page
    .getByTestId("payment-row")
    .filter({ hasText: customerName })
    .getByRole("link");
  const paymentId = new URL(
    (await paymentLink.getAttribute("href")) ?? "",
    "http://localhost",
  ).searchParams.get("payment");
  await navigateInApp(page, `/pay/${paymentId}`);
  await expect(page.getByRole("note", { name: "Test mode" })).toBeVisible();
}

async function fillCard(page: Page, cardNumber: string) {
  const cardForm = page.getByRole("form", { name: "Card details" });
  await cardForm.getByLabel("Card number").fill(cardNumber);
  await cardForm.getByLabel("Expiry (MM/YY)").fill("12/34");
  await cardForm.getByLabel("CVC").fill("123");
  await cardForm.getByRole("button", { name: /^Pay / }).click();
}

const checkoutResult = (page: Page) =>
  page.getByRole("region", { name: "Checkout result" });

test("PY-01.4 and PY-03.2 each provider has its theme under the TEST MODE banner", async ({
  page,
}) => {
  await openCheckout(page, "Lena Vogel");
  await expect(page.getByText("TEST MODE: no real payment")).toBeVisible();
  await expect(page.getByRole("form", { name: "Card details" })).toBeVisible();
  await expect(page.locator("[data-checkout-theme]")).toHaveAttribute(
    "data-checkout-theme",
    "stripe",
  );

  await openCheckout(page, "Omar Farouk");
  await expect(
    page.getByRole("button", { name: /Approve and pay/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Require 3-D Secure" }),
  ).toBeHidden();

  await openCheckout(page, "Nadia Islam");
  await expect(page.getByRole("tab", { name: "Mobile banking" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Net banking" })).toBeVisible();

  await openCheckout(page, "Ruma Begum");
  await expect(page.getByLabel("Your bKash account number")).toBeVisible();
});

test("PY-03.1 a test card pays and shows where the browser goes", async ({
  page,
}) => {
  await openCheckout(page, "Lena Vogel");
  await fillCard(page, "4242 4242 4242 4242");

  await expect(checkoutResult(page)).toContainText("Payment successful");
  await expect(page.getByTestId("redirect-url")).toHaveText(
    "http://localhost:8000/checkout/success",
  );
  await expect(
    page.getByRole("link", { name: "Return to Acme Shop" }),
  ).toHaveAttribute("href", /checkout\/success\?session_id=cs_test_/);

  await navigateInApp(page, "/payments");
  await expect(
    page.getByTestId("payment-row").filter({ hasText: "Lena Vogel" }),
  ).toContainText("Succeeded");
});

test("PY-01.1 a real card number is refused on the page and never sent", async ({
  page,
}) => {
  await openCheckout(page, "Lena Vogel");
  const completeRequests: string[] = [];
  page.on("request", (sentRequest) => {
    if (sentRequest.url().includes("/complete")) {
      completeRequests.push(sentRequest.url());
    }
  });

  await fillCard(page, "4111 1111 1111 1111");

  await expect(
    page.getByText("Use a test card: real card numbers are never accepted"),
  ).toBeVisible();
  expect(completeRequests).toEqual([]);
  await expect(page.getByRole("form", { name: "Card details" })).toBeVisible();
});

test("PY-03.1 3-D Secure can be approved or failed", async ({ page }) => {
  await openCheckout(page, "Sam Lee");
  const challenge = page.getByRole("region", { name: "3-D Secure" });
  await challenge.getByRole("button", { name: "Approve" }).click();
  await expect(checkoutResult(page)).toContainText("Payment successful");

  await openCheckout(page, "Lena Vogel");
  await fillCard(page, "4000 0025 0000 3155");
  await page.getByRole("button", { name: "Fail authentication" }).click();
  await expect(checkoutResult(page)).toContainText("Payment declined");
  await expect(checkoutResult(page)).toContainText("authentication failed");
});

test("PY-03.1 test controls decline with a reason, delay and cancel", async ({
  page,
}) => {
  await openCheckout(page, "Lena Vogel");
  const testControls = page.getByRole("complementary", {
    name: "Test controls",
  });
  await testControls.getByRole("combobox", { name: "Decline reason" }).click();
  await page.getByRole("option", { name: "Expired card" }).click();
  await testControls.getByRole("button", { name: "Decline" }).click();
  await expect(checkoutResult(page)).toContainText("expired card");
  await expect(page.getByTestId("redirect-url")).toHaveText(
    "http://localhost:8000/checkout/fail",
  );

  await openCheckout(page, "Nadia Islam");
  await page.getByRole("button", { name: "Delay" }).click();
  await expect(checkoutResult(page)).toContainText("Payment pending");

  await openCheckout(page, "Omar Farouk");
  await page
    .getByRole("button", { name: "Cancel and return to Acme Shop" })
    .click();
  await expect(checkoutResult(page)).toContainText("Payment canceled");
});

test("PY-03.2 SSLCommerz mobile banking pays and returns by POST", async ({
  page,
}) => {
  await openCheckout(page, "Nadia Islam");
  await page.getByRole("tab", { name: "Mobile banking" }).click();
  await page.getByRole("button", { name: "Pay with bKash" }).click();

  await expect(checkoutResult(page)).toContainText("by POST");
  const fieldsSent = page.getByRole("definition").filter({ hasText: "VALID" });
  await expect(fieldsSent).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Return to Acme Shop" }),
  ).toBeVisible();
});

test("PY-03.2 bKash asks for the wallet, OTP and PIN, and asks again after a wrong PIN", async ({
  page,
}) => {
  await openCheckout(page, "Ruma Begum");
  const walletForm = page.getByRole("form", { name: "bKash payment" });
  await walletForm.getByLabel("Your bKash account number").fill("01770000003");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("Verification code").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  await expect(walletForm.getByText("Wrong PIN. Try again.")).toBeVisible();

  await walletForm.getByRole("button", { name: "Change number" }).click();
  await walletForm.getByLabel("Your bKash account number").fill("01770000001");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("Verification code").fill("123456");
  await walletForm.getByRole("button", { name: "Confirm" }).click();
  await walletForm.getByLabel("PIN").fill("12121");
  await walletForm.getByRole("button", { name: "Confirm and pay" }).click();
  await expect(checkoutResult(page)).toContainText("Payment successful");
});

test("PY-03.3 a finished checkout says it is closed and offers no way to pay", async ({
  page,
}) => {
  await openCheckout(page, "Ayesha Khan");

  await expect(checkoutResult(page)).toContainText(
    "This checkout is closed and cannot be paid again",
  );
  await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Test controls" }),
  ).toHaveCount(0);
});

test("PY-03.4 the card form works from the keyboard", async ({ page }) => {
  await openCheckout(page, "Lena Vogel");
  await expect(page.getByLabel("Card number")).toBeVisible();
  // Start from the top of the page, as a visitor arriving from the shop does.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Card number")).toBeFocused();
  await page.keyboard.type("4242424242424242");
  await page.keyboard.press("Tab");
  await page.keyboard.type("12/34");
  await page.keyboard.press("Tab");
  await page.keyboard.type("123");
  await page.keyboard.press("Enter");

  await expect(checkoutResult(page)).toContainText("Payment successful");
});
