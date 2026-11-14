import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import { makeUniqueName, sendEmail } from "./live-webhooks";

const emailList = "section[aria-label='Email list']";

type LiveMessageRule = {
  id: string;
  name: string;
  is_enabled: boolean;
  position: number;
  tag?: string;
  to?: string[];
};

type LiveEmailSummary = {
  id: string;
  subject: string;
  direction: string;
  tags: string[];
};

async function listRules(
  request: APIRequestContext,
  ruleKind: "tag-rules" | "forward-rules",
): Promise<LiveMessageRule[]> {
  const rules = (await (
    await request.get(`/api/v1/${ruleKind}`)
  ).json()) as LiveMessageRule[];

  return rules.toSorted(
    (firstRule, secondRule) => firstRule.position - secondRule.position,
  );
}

async function findRule(
  request: APIRequestContext,
  ruleKind: "tag-rules" | "forward-rules",
  ruleName: string,
): Promise<LiveMessageRule | undefined> {
  return (await listRules(request, ruleKind)).find(
    (messageRule) => messageRule.name === ruleName,
  );
}

async function readEmailTags(
  request: APIRequestContext,
  emailId: string,
): Promise<string[]> {
  return (
    (
      (await (await request.get(`/api/v1/emails/${emailId}`)).json()) as {
        tags?: string[];
      }
    ).tags ?? []
  );
}

async function findEmailBySubject(
  request: APIRequestContext,
  subject: string,
): Promise<LiveEmailSummary | undefined> {
  const emailPage = (await (await request.get("/api/v1/emails")).json()) as {
    items?: LiveEmailSummary[];
  };

  return (emailPage.items ?? []).find((email) => email.subject === subject);
}

function findRulesCard(page: Page, cardTitle: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: cardTitle }) });
}

/** Adds a tag rule through the Settings sheet that tags mail from `senderAddress`. */
async function addTagRule(
  page: Page,
  ruleName: string,
  tag: string,
  senderAddress: string,
) {
  await findRulesCard(page, "Tag rules")
    .getByRole("button", { name: "Add rule" })
    .click();
  const ruleSheet = page.getByRole("dialog", { name: "Add a tag rule" });
  await ruleSheet.getByLabel("Name").fill(ruleName);
  await ruleSheet.getByLabel("Tag").fill(tag);
  await ruleSheet.getByRole("button", { name: "Add condition" }).click();
  await ruleSheet.getByRole("textbox", { name: "Value 1" }).fill(senderAddress);
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet).toBeHidden();
}

async function importEml(page: Page, messageText: string, isIncoming: boolean) {
  await page.getByRole("button", { name: "Import .eml" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import .eml" });
  if (isIncoming) {
    await importDialog.getByText("Incoming to your app").click();
  }
  await importDialog.getByLabel("Message").fill(messageText);
  await importDialog.getByRole("button", { name: "Import" }).click();
  await expect(importDialog).toBeHidden();
}

test("UI-11.6 Import .eml stores a live message as sent or as incoming", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  const sentSubject = makeUniqueName("Imported hello");
  const incomingSubject = makeUniqueName("Need help");
  await page.goto("/mail");

  await importEml(
    page,
    `From: app@app.test\nTo: rahim@example.test\nSubject: ${sentSubject}\n\nHi there.`,
    false,
  );
  await expect(
    page.locator(emailList).getByText(sentSubject, { exact: true }),
  ).toBeVisible();
  await importEml(
    page,
    `From: rahim@example.test\nTo: support@inbound.app.test\nSubject: ${incomingSubject}\n\nIt broke.`,
    true,
  );
  await page
    .locator(emailList)
    .getByText(incomingSubject, { exact: true })
    .click();
  await expect(page.getByText("Inbound").first()).toBeVisible();

  expect((await findEmailBySubject(request, sentSubject))?.direction).toBe(
    "outbound",
  );
  expect((await findEmailBySubject(request, incomingSubject))?.direction).toBe(
    "inbound",
  );
  expect(failedApiCalls).toEqual([]);
});

test("UI-11.6 live tag rules are added, ordered, switched off and deleted, and tag new mail", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  const senderAddress = `${makeUniqueName("receipts").replace(" ", "-")}@shop.test`;
  const tag = makeUniqueName("receipts").replace(" ", "-");
  const firstRuleName = makeUniqueName("Live first tag rule");
  const ruleName = makeUniqueName("Live receipts");
  await page.goto("/settings?section=email");
  await addTagRule(page, firstRuleName, "first", "nobody@nowhere.test");
  await addTagRule(page, ruleName, tag, senderAddress);

  const taggedEmailId = await sendEmail(
    request,
    makeUniqueName("Receipt"),
    senderAddress,
  );
  await expect
    .poll(async () => readEmailTags(request, taggedEmailId))
    .toContain(tag);

  await page.getByRole("button", { name: `Move ${ruleName} up` }).click();
  await expect
    .poll(async () => {
      const ruleNames = (await listRules(request, "tag-rules")).map(
        (messageRule) => messageRule.name,
      );

      return ruleNames.indexOf(ruleName) < ruleNames.indexOf(firstRuleName);
    })
    .toBe(true);

  await page.getByRole("switch", { name: `${ruleName} enabled` }).click();
  await expect
    .poll(
      async () => (await findRule(request, "tag-rules", ruleName))?.is_enabled,
    )
    .toBe(false);
  const untaggedEmailId = await sendEmail(
    request,
    makeUniqueName("Receipt"),
    senderAddress,
  );
  expect(await readEmailTags(request, untaggedEmailId)).not.toContain(tag);

  for (const deletedRuleName of [ruleName, firstRuleName]) {
    await page
      .getByRole("button", { name: `Delete ${deletedRuleName}` })
      .click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByTestId("message-rule-row").filter({ hasText: deletedRuleName }),
    ).toHaveCount(0);
  }
  expect(await findRule(request, "tag-rules", ruleName)).toBeUndefined();
  expect(failedApiCalls).toEqual([]);
});

test("UI-11.6 a live auto-forward rule needs an address, is stored, switched off and deleted", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  const ruleName = makeUniqueName("Live ops copies");
  await page.goto("/settings?section=email");
  await findRulesCard(page, "Auto-forward rules")
    .getByRole("button", { name: "Add rule" })
    .click();
  const ruleSheet = page.getByRole("dialog", {
    name: "Add an auto-forward rule",
  });
  await ruleSheet.getByLabel("Name").fill(ruleName);
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();
  await expect(ruleSheet.getByText("Add at least one address")).toBeVisible();
  await ruleSheet.getByLabel("Forward to").fill("ops@company.test");
  await ruleSheet.getByLabel("Forward to").press("Enter");
  await ruleSheet.getByRole("button", { name: "Add rule" }).click();

  await expect(
    page.getByTestId("message-rule-row").filter({ hasText: ruleName }),
  ).toContainText("ops@company.test");
  expect((await findRule(request, "forward-rules", ruleName))?.to).toEqual([
    "ops@company.test",
  ]);
  await page.getByRole("switch", { name: `${ruleName} enabled` }).click();
  await expect
    .poll(
      async () =>
        (await findRule(request, "forward-rules", ruleName))?.is_enabled,
    )
    .toBe(false);
  await page.getByRole("button", { name: `Delete ${ruleName}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect
    .poll(async () => findRule(request, "forward-rules", ruleName))
    .toBeUndefined();
  expect(failedApiCalls).toEqual([]);
});
