import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import {
  createEndpoint,
  createRule,
  makeUniqueName,
  pickOption,
  sendEmail,
} from "./live-webhooks";

/** Nothing listens on port 9, so a delivery there fails at once. */
const unreachableUrl = "http://127.0.0.1:9/hooks";

type LiveRule = {
  id: string;
  name: string;
  order: number;
  is_enabled: boolean;
};

async function listRules(request: APIRequestContext): Promise<LiveRule[]> {
  return (await (
    await request.get("/api/v1/webhooks/rules")
  ).json()) as LiveRule[];
}

function findRuleRow(page: Page, ruleName: string) {
  return page.getByRole("row").filter({ hasText: ruleName });
}

/** The names of the rules on screen that are in `ruleNames`, in the order shown. */
async function readShownOrder(page: Page, ruleNames: string[]) {
  const shownNames = await page
    .locator("tbody tr td:nth-child(2) span:first-child")
    .allTextContents();

  return shownNames
    .map((shownName) => shownName.trim())
    .filter((shownName) => ruleNames.includes(shownName));
}

test("WH-02.6 the live list shows order, endpoint, events and a plain-language filter", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live rules endpoint");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    unreachableUrl,
  );
  const filteredRule = makeUniqueName("Live bounces");
  const everyEventRule = makeUniqueName("Live everything");
  await createRule(request, filteredRule, endpointId, ["email.bounced"], {
    field: "to",
    operator: "matches",
    value: "*@example.com",
  });
  await createRule(request, everyEventRule, endpointId, ["email.received"]);
  const failedApiCalls = watchFailedApiCalls(page);
  await page.goto("/webhooks/rules");

  const filteredRow = findRuleRow(page, filteredRule);
  await expect(filteredRow).toContainText(`to ${endpointName}`);
  await expect(filteredRow).toContainText("email.bounced");
  await expect(filteredRow.getByTestId("filter-summary")).toHaveText(
    "to matches *@example.com",
  );
  await expect(
    findRuleRow(page, everyEventRule).getByTestId("filter-summary"),
  ).toHaveText("Every event");
  expect(failedApiCalls).toEqual([]);
});

test("WH-02.6 live rules are reordered, switched and filtered by endpoint on the server", async ({
  page,
  request,
}) => {
  const endpointName = makeUniqueName("Live order endpoint");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    unreachableUrl,
  );
  const firstRule = makeUniqueName("Live first");
  const secondRule = makeUniqueName("Live second");
  await createRule(request, firstRule, endpointId, ["email.received"]);
  await createRule(request, secondRule, endpointId, ["email.received"]);
  const ruleNames = [firstRule, secondRule];
  await page.goto("/webhooks/rules");
  await expect(findRuleRow(page, secondRule)).toBeVisible();
  expect(await readShownOrder(page, ruleNames)).toEqual(ruleNames);

  await page.getByRole("button", { name: `Move ${secondRule} up` }).click();
  await expect
    .poll(() => readShownOrder(page, ruleNames))
    .toEqual([secondRule, firstRule]);
  const savedOrder = (await listRules(request))
    .filter((rule) => ruleNames.includes(rule.name))
    .sort((left, right) => left.order - right.order)
    .map((rule) => rule.name);
  expect(savedOrder).toEqual([secondRule, firstRule]);

  await page.getByRole("switch", { name: `${firstRule} enabled` }).click();
  await expect
    .poll(
      async () =>
        (await listRules(request)).find((rule) => rule.name === firstRule)
          ?.is_enabled,
    )
    .toBe(false);

  await pickOption(page, "Endpoint filter", endpointName);
  await expect(page).toHaveURL(/\/webhooks\/rules\?endpoint=/);
  await expect(page.locator("tbody tr")).toHaveCount(2);
});

test("WH-02.3 the preview shows which of the last stored messages match", async ({
  page,
  request,
}) => {
  const sender = `${makeUniqueName("billing").replaceAll(" ", "-")}@acme.test`;
  await sendEmail(request, "Live invoice", sender);
  const endpointName = makeUniqueName("Live preview endpoint");
  const endpointId = await createEndpoint(
    request,
    endpointName,
    unreachableUrl,
  );
  const ruleName = makeUniqueName("Live preview");
  await createRule(request, ruleName, endpointId, ["email.received"], {
    field: "subject",
    operator: "contains",
    value: "no message has this subject",
  });
  await page.goto("/webhooks/rules");

  await page.getByRole("button", { name: `Edit ${ruleName}` }).click();
  const ruleSheet = page.getByRole("dialog", { name: ruleName });
  const previewSummary = ruleSheet.getByTestId("preview-summary");
  await expect(previewSummary).toHaveText(
    /^Matches 0 of the last \d+ messages$/,
  );

  await pickOption(page, "Field 1", "From");
  await ruleSheet.getByRole("textbox", { name: "Value 1" }).fill(sender);
  await expect(previewSummary).toHaveText(
    /^Matches 1 of the last \d+ messages$/,
  );
  const matchingItems = ruleSheet.locator(
    "[data-testid='preview-item'][data-match='true']",
  );
  await expect(matchingItems).toHaveCount(1);
  await expect(matchingItems.first()).toContainText(sender);
  await expect(ruleSheet.locator("[data-match='false']")).toHaveCount(0);

  await ruleSheet.getByText("Show non-matching").click();
  await expect(ruleSheet.locator("[data-match='false']").first()).toBeVisible();
});
