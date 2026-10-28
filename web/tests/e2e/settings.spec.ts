import { expect, test } from "@playwright/test";

test("PL-05.3 a section saves only when changed, and Discard restores it", async ({
  page,
}) => {
  await page.goto("/settings?section=sms");
  const simulationForm = page.getByRole("form", {
    name: "Delivery simulation",
  });
  const saveButton = simulationForm.getByRole("button", {
    name: "Save changes",
  });
  await expect(saveButton).toBeDisabled();

  await simulationForm.getByText("Manual", { exact: true }).click();
  await expect(saveButton).toBeEnabled();
  await expect(simulationForm.getByText("Unsaved changes")).toBeVisible();
  await simulationForm.getByRole("button", { name: "Discard" }).click();
  await expect(simulationForm.getByLabel("Realistic")).toBeChecked();
  await expect(saveButton).toBeDisabled();

  await simulationForm.getByText("Manual", { exact: true }).click();
  await saveButton.click();
  await expect(page.getByText("Settings saved")).toBeVisible();
});

test("PL-05.1 a saved setting is kept when the section is opened again", async ({
  page,
}) => {
  await page.goto("/settings?section=opened-events");
  const openedForm = page.getByRole("form", { name: "Opened events" });
  await openedForm.getByText("Every open", { exact: true }).click();
  await openedForm.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.getByRole("link", { name: "General" }).click();
  await page.getByRole("link", { name: "Opened events" }).click();
  await expect(
    page.getByRole("form", { name: "Opened events" }).getByLabel("Every open"),
  ).toBeChecked();
});

test("PL-05.2 an invalid value shows a message under its field", async ({
  page,
}) => {
  await page.goto("/settings");
  const retentionForm = page.getByRole("form", { name: "Retention" });
  await retentionForm.getByLabel("Keep at most").first().fill("0");
  await retentionForm.getByRole("button", { name: "Save changes" }).click();

  await expect(retentionForm.getByText("Choose 1 to 1,000,000")).toBeVisible();
});

test("PL-05.4 delete all SMS asks first, then deletes", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete all SMS" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Delete all SMS" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete all SMS" })
    .click();
  await expect(page.getByText("All SMS deleted")).toBeVisible();

  await page.getByRole("link", { name: "SMS", exact: true }).first().click();
  await expect(page.getByText("No SMS yet")).toBeVisible();
});

test("PL-04.6 the seed can be exported, validated and applied", async ({
  page,
}) => {
  await page.goto("/settings?section=seed");
  await expect(page.getByText("./sendmock.seed.toml")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Changed since the seed" }),
  ).toContainText("Virtual number");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export sendmock.seed.toml" }).click();
  const seedDownload = await downloadPromise;
  expect(seedDownload.suggestedFilename()).toBe("sendmock.seed.toml");

  const seedField = page.getByLabel("Seed file (TOML)");
  await seedField.fill('[[numbers]]\nnumber = "+15550007777\nlabel = Sales');
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("list", { name: "Seed errors" })).toContainText(
    "Line 2: A string is missing its closing quote",
  );
  await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();

  await seedField.fill('[[numbers]]\nnumber = "+15550007777"\nlabel = "Sales"');
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("list", { name: "Seed summary" })).toContainText(
    "1 x Virtual number",
  );
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Apply" })
    .click();
  await expect(page.getByText("Seed file applied")).toBeVisible();
});

test("EM-05.5 the OTP tester shows the matching pattern and invalid patterns are flagged", async ({
  page,
}) => {
  await page.goto("/settings?section=otp");
  await expect(page.getByText(/Pattern 1 found/)).toContainText("482913");

  await page.getByLabel("Try a message").fill("Use 739201 to sign in");
  await expect(page.getByText(/Pattern 2 found/)).toContainText("739201");

  await page.getByRole("button", { name: "Add pattern" }).click();
  await page.getByLabel("Pattern 3", { exact: true }).fill("([0-9");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Pattern 3 is not a valid regular expression"),
  ).toBeVisible();
});

test("turning on chaos shows a badge in the section nav", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/settings?section=chaos");
  await expect(page.getByText("Chaos on")).toHaveCount(0);

  await page.getByLabel("Reject the next").fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }),
  ).toContainText("Chaos on");
});

test("the relay password is masked after saving", async ({ page }) => {
  await page.goto("/settings?section=email");
  const relayForm = page.getByRole("form", { name: "Release to real SMTP" });
  await relayForm
    .getByLabel("Relay SMTP URL")
    .fill("smtp://user:secret@smtp.example.com:587");
  await relayForm.getByLabel("Allowed recipients").fill("*@qa.company.com");
  await relayForm.getByRole("button", { name: "Add" }).click();
  await relayForm.getByRole("button", { name: "Save changes" }).click();

  await expect(relayForm.getByLabel("Relay SMTP URL")).toHaveValue(
    "smtp://user:••••••••@smtp.example.com:587",
  );
});

test("PL-05.5 snippets follow the language and where the app runs", async ({
  page,
}) => {
  await page.goto("/settings?section=connection");
  await page.getByLabel("Language").click();
  await page.getByRole("option", { name: "Python" }).click();
  await page.getByLabel("Where does your app run?").click();
  await page
    .getByRole("option", { name: "In the same Docker Compose project" })
    .click();

  await expect(page.getByRole("region", { name: "SMTP" })).toContainText(
    'smtplib.SMTP("sendmock", 1025)',
  );
  await expect(page.getByRole("region", { name: "SMS API" })).toContainText(
    '"http://sendmock:8025/api/v1/sms"',
  );
});

test("PL-05.7 custom headers and payload fields show up in the snippets", async ({
  page,
}) => {
  await page.goto("/settings?section=connection");
  await page.getByText("Customize the request").click();

  await page.getByRole("button", { name: "Add Authorization header" }).click();
  await page.getByLabel("Header 1 value").fill("Bearer token-1");
  await page.getByRole("button", { name: "metadata" }).click();

  const smsSnippet = page.getByRole("region", { name: "SMS API" });
  await expect(smsSnippet).toContainText("Http::withHeaders(");
  await expect(smsSnippet).toContainText("'Authorization' => 'Bearer token-1'");
  await expect(smsSnippet).toContainText("'metadata' => [");

  await page.getByLabel("Language").click();
  await page.getByRole("option", { name: "cURL" }).click();
  await expect(smsSnippet).toContainText('-H "Authorization: Bearer token-1"');
  await expect(smsSnippet).toContainText('"metadata":{"order_id":42}');

  await page.getByLabel("Email body (POST /api/v1/send)").fill("{");
  await expect(page.getByText("Not valid JSON yet")).toBeVisible();
  await expect(page.getByRole("region", { name: "Email API" })).toContainText(
    '"subject":"Hi"',
  );
});

test("PL-05.6 About shows the version and channel, and the update check stays off until it is turned on", async ({
  page,
}) => {
  await page.goto("/settings?section=about");
  await expect(page.getByText("0.1.0-beta.2", { exact: true })).toBeVisible();
  await expect(page.getByText("(beta)")).toBeVisible();
  const checkButton = page.getByRole("button", { name: "Check for updates" });
  await expect(checkButton).toBeDisabled();

  const updatesForm = page.getByRole("form", { name: "Updates" });
  await updatesForm.getByRole("radio", { name: /^Manual/ }).check();
  await expect(checkButton).toBeDisabled();
  await updatesForm.getByRole("button", { name: "Save changes" }).click();
  await checkButton.click();
  await expect(
    page.getByText("SendMock 0.2.0-beta.1 is available"),
  ).toBeVisible();
});

test("Reset puts the request back to the sample", async ({ page }) => {
  await page.goto("/settings?section=connection");
  await page.getByText("Customize the request").click();
  const resetButton = page.getByRole("button", { name: "Reset", exact: true });
  await expect(resetButton).toBeDisabled();

  await page.getByRole("button", { name: "Add Authorization header" }).click();
  await page.getByRole("button", { name: "metadata" }).click();
  await expect(resetButton).toBeEnabled();
  await resetButton.click();

  await expect(page.getByLabel("Header 1 name")).toHaveCount(0);
  await expect(page.getByLabel("SMS body (POST /api/v1/sms)")).not.toHaveValue(
    /metadata/,
  );
  await expect(page.getByRole("region", { name: "SMS API" })).not.toContainText(
    "withHeaders",
  );
  await expect(resetButton).toBeDisabled();
});
