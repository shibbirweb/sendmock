import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/webhooks/endpoints");
  await expect(
    page.getByRole("row").filter({ hasText: "SMS status callbacks" }),
  ).toBeVisible();
});

function findEndpointRow(page: Page, endpointName: string) {
  return page.getByRole("row").filter({ hasText: endpointName });
}

async function openEndpointSheet(page: Page, endpointName: string) {
  await page.getByRole("button", { name: `Edit ${endpointName}` }).click();
  return page.getByRole("dialog", { name: endpointName });
}

test("WH-01.1 endpoints can be added, edited, disabled and deleted", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add endpoint" }).click();
  const addSheet = page.getByRole("dialog", { name: "Add an endpoint" });
  await addSheet.getByLabel("Name").fill("Orders service");
  await addSheet.getByLabel("URL").fill("http://localhost:4000/hooks");
  await addSheet.getByRole("button", { name: "Add endpoint" }).click();

  const editSheet = page.getByRole("dialog", { name: "Orders service" });
  await expect(editSheet.getByRole("tab", { name: "Security" })).toBeEnabled();
  await editSheet.getByLabel("Name").fill("Orders API");
  await editSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(findEndpointRow(page, "Orders API")).toContainText(
    "http://localhost:4000/hooks",
  );

  await page.getByRole("switch", { name: "Orders API enabled" }).click();
  await expect(
    page.getByRole("switch", { name: "Orders API enabled" }),
  ).not.toBeChecked();

  await page.getByRole("button", { name: "Delete Orders API" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(findEndpointRow(page, "Orders API")).toBeHidden();
});

test("WH-01.2 Send test delivers test.ping and shows the response", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Send test to Team Slack alerts" })
    .click();
  const testDialog = page.getByRole("dialog", {
    name: "Test sent to Team Slack alerts",
  });

  await expect(testDialog).toContainText("200");
  await expect(testDialog).toContainText("webhook-signature");
  await expect(testDialog).toContainText('{"received":true}');
  await testDialog.getByRole("link", { name: "Open delivery" }).click();
  await expect(page).toHaveURL(/\/webhooks\/deliveries\?delivery=[0-9A-Z]+/);
});

test("WH-01.3 the secret stays masked until a confirmed reveal", async ({
  page,
}) => {
  const endpointSheet = await openEndpointSheet(page, "Laravel inbound mail");
  await endpointSheet.getByRole("tab", { name: "Security" }).click();
  const secretText = endpointSheet.getByTestId("endpoint-secret");
  await expect(secretText).toHaveText(/^whsec_••••.{4}$/);

  await endpointSheet.getByRole("button", { name: "Reveal" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(secretText).toHaveText(/^whsec_••••.{4}$/);

  await endpointSheet.getByRole("button", { name: "Reveal" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reveal" })
    .click();
  await expect(secretText).toHaveText(/^whsec_[A-Za-z0-9]{32}$/);
  await expect(
    endpointSheet.getByRole("button", { name: "Copy secret" }),
  ).toBeVisible();
});

test("WH-01.4 a localhost URL in Docker shows the host.docker.internal hint", async ({
  page,
}) => {
  await expect(
    page.getByRole("img", { name: /host\.docker\.internal/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByLabel("Running in Docker").click();
  await page.keyboard.press("Escape");

  await expect(
    findEndpointRow(page, "Laravel inbound mail").getByRole("img", {
      name: /host\.docker\.internal/,
    }),
  ).toBeVisible();
  const endpointSheet = await openEndpointSheet(page, "Laravel inbound mail");
  await endpointSheet
    .getByRole("button", { name: "Use host.docker.internal" })
    .click();
  await expect(endpointSheet.getByLabel("URL")).toHaveValue(
    "http://host.docker.internal:8000/webhooks/inbound-mail",
  );
});

test("WH-01.5 timeout and retries are validated and the schedule is previewed", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add endpoint" }).click();
  const addSheet = page.getByRole("dialog", { name: "Add an endpoint" });
  await addSheet.getByLabel("Name").fill("Slow service");
  await addSheet.getByLabel("URL").fill("not a url");
  await addSheet.getByLabel("Timeout (seconds)").fill("90");
  await addSheet.getByRole("button", { name: "Add endpoint" }).click();
  await expect(
    addSheet.getByText("Enter an http:// or https:// URL"),
  ).toBeVisible();
  await expect(addSheet.getByText("Use 1 to 60 seconds")).toBeVisible();

  await addSheet.getByLabel("URL").fill("http://localhost:4000/hooks");
  await addSheet.getByLabel("Timeout (seconds)").fill("10");
  await addSheet.getByRole("tab", { name: "Retries" }).click();
  await expect(addSheet.getByTestId("attempt-schedule")).toHaveText(
    "Attempts at 0 s, 1 s, 6 s, 36 s, 2 m 36 s.",
  );
  await addSheet.getByLabel("Max attempts").fill("11");
  await addSheet.getByRole("tab", { name: "General" }).click();
  await addSheet.getByRole("button", { name: "Add endpoint" }).click();
  await expect(addSheet.getByRole("tab", { name: "Retries" })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(addSheet.getByText("Use 1 to 10 attempts")).toBeVisible();
});

test("WH-01.6 required template variables show as missing until set", async ({
  page,
}) => {
  const endpointSheet = await openEndpointSheet(page, "SMS status callbacks");
  await endpointSheet.getByRole("tab", { name: "Variables" }).click();
  const requiredVariable = endpointSheet.getByTestId("required-variable");
  await expect(requiredVariable).toContainText("twilio_auth_token");
  await expect(requiredVariable).toContainText("Missing");

  await endpointSheet
    .getByLabel("Value for twilio_auth_token")
    .fill("auth-token-1234");
  // Enter sets the variable and keeps the sheet open (it is one form).
  await endpointSheet.getByLabel("Value for twilio_auth_token").press("Enter");
  await expect(requiredVariable).not.toContainText("Missing");
  const endpointVariables = endpointSheet.getByRole("list", {
    name: "Endpoint variables",
  });
  await expect(endpointVariables).toContainText("secret");
  await expect(endpointVariables).toContainText("••••••••1234");
  await expect(endpointVariables).not.toContainText("auth-token-1234");
});

test("WH-01.6 a global variable satisfies a template's need", async ({
  page,
}) => {
  const endpointSheet = await openEndpointSheet(page, "Laravel inbound mail");
  await endpointSheet.getByRole("tab", { name: "Template" }).click();
  await endpointSheet.getByRole("combobox").click();
  await page
    .getByRole("option", { name: "Postmark inbound with tenant header" })
    .click();
  await endpointSheet.getByRole("tab", { name: "Variables" }).click();

  await expect(endpointSheet.getByTestId("required-variable")).toContainText(
    "Set globally",
  );
});

test("WH-01.7 the table shows success sparklines and the switch applies at once", async ({
  page,
}) => {
  const callbacksRow = findEndpointRow(page, "SMS status callbacks");
  await expect(callbacksRow.getByTestId("success-sparkline")).toBeVisible();
  await expect(callbacksRow).toContainText(/\d+%/);
  await expect(
    findEndpointRow(page, "Everything as native JSON"),
  ).toContainText("n/a");

  const nativeSwitch = page.getByRole("switch", {
    name: "Everything as native JSON enabled",
  });
  await nativeSwitch.click();
  await expect(
    page.getByText("Everything as native JSON enabled"),
  ).toBeVisible();
  await expect(nativeSwitch).toBeChecked();
});

test("WH-01.8 rotating the secret shows the new secret and the overlap end", async ({
  page,
}) => {
  const endpointSheet = await openEndpointSheet(page, "Team Slack alerts");
  await endpointSheet.getByRole("tab", { name: "Security" }).click();
  const secretText = endpointSheet.getByTestId("endpoint-secret");
  const maskedSecretBefore = await secretText.textContent();
  await expect(
    endpointSheet.getByTestId("previous-secret-expiry"),
  ).toBeHidden();

  await endpointSheet.getByRole("button", { name: "Rotate secret" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Rotate" })
    .click();

  await expect(secretText).not.toHaveText(maskedSecretBefore ?? "");
  await expect(
    endpointSheet.getByTestId("previous-secret-expiry"),
  ).toContainText("The previous secret also signs until");
});
