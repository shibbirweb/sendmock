import { expect, type Page, test } from "@playwright/test";

async function openBin(page: Page, binName: string) {
  await page.goto("/http");
  await page
    .getByRole("navigation", { name: "Bin list" })
    .getByRole("button", { name: new RegExp(`^${binName}`) })
    .click();
}

test("PL-21.1 PL-21.5 a provider's unmatched requests go to a bin made for it, which lists the provider", async ({
  page,
}) => {
  await page.goto("/sms/providers");
  await page.getByRole("button", { name: "Edit Twilio", exact: true }).click();
  const providerSheet = page.getByRole("dialog", { name: "Twilio" });
  const unmatchedRequests = providerSheet.getByRole("region", {
    name: "Unmatched requests",
  });
  await expect(
    unmatchedRequests.getByRole("combobox", {
      name: "Where Twilio's unmatched requests go",
    }),
  ).toHaveText("Answer 404");

  await unmatchedRequests
    .getByRole("button", { name: "Create a bin for this provider" })
    .click();
  await expect(
    unmatchedRequests.getByRole("combobox", {
      name: "Where Twilio's unmatched requests go",
    }),
  ).toHaveText("Bin twilio-gaps");
  await unmatchedRequests.getByRole("link", { name: "Open its rules" }).click();

  await expect(page).toHaveURL(/\/http\?.*tab=responses/);
  await expect(page.getByText("Answers unmatched requests for")).toBeVisible();
  await expect(page.getByText("twilio (SMS)")).toBeVisible();
  await page.getByRole("button", { name: "Detach twilio" }).click();
  await expect(page.getByText("Answers unmatched requests for")).toBeHidden();
});

test("PL-21.4 a response rule can send a follow-up webhook to a URL from the request", async ({
  page,
}) => {
  await openBin(page, "push");
  await page.getByRole("tab", { name: "Responses" }).click();
  await page.getByRole("button", { name: "Add rule" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a rule" });
  await ruleSheet.getByLabel("Name", { exact: true }).fill("Calls");
  await ruleSheet.getByLabel("Send a webhook after answering").check();
  await ruleSheet
    .getByLabel("URL", { exact: true })
    .fill("{{ request.form.StatusCallback }}");
  await ruleSheet.getByLabel("After (ms)").fill("700000");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet).toContainText("Use 0 to 600,000 ms");

  await ruleSheet.getByLabel("After (ms)").fill("1000");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet).toBeHidden();
});
