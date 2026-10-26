import { expect, test } from "@playwright/test";

test("UI-11.3 every operation in the reference shows its CLI command, MCP tool and place in the app", async ({
  page,
}) => {
  await page.goto("/api/");
  const tagPaths = await page
    .locator("main a[href^='/api/']")
    .evaluateAll((anchors) => [
      ...new Set(
        anchors.map(
          (anchor) => (anchor.getAttribute("href") ?? "").split("#")[0],
        ),
      ),
    ]);
  expect(tagPaths.length).toBeGreaterThan(10);

  for (const tagPath of tagPaths) {
    await page.goto(tagPath);
    const operations = page.getByTestId("api-operation");
    const operationCount = await operations.count();
    for (
      let operationIndex = 0;
      operationIndex < operationCount;
      operationIndex += 1
    ) {
      const otherWays = operations.nth(operationIndex).getByRole("definition");
      await expect(otherWays.first(), tagPath).toContainText("sendmock ");
    }
  }

  await page.goto("/api/email/");
  const replyOperation = page.locator("#postEmailsByEmailIdReply");
  await expect(replyOperation).toContainText("sendmock email reply <emailId>");
  await expect(replyOperation).toContainText("sendmock_email_reply");
  await page.goto("/api/webhook-endpoints/");
  await expect(
    page.locator("#getWebhooksEndpointsByEndpointIdSecret"),
  ).toContainText("None: Agents may set secrets but never read them back");
});
