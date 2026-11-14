import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

test("EM-21.6 Settings > Connection shows the POP3 port the binary listens on", async ({
  page,
  request,
}) => {
  watchFailedApiCalls(page);
  const appInfo = (await (await request.get("/api/v1/info")).json()) as {
    pop3_address: string | null;
  };
  const pop3Port = appInfo.pop3_address?.split(":").at(-1) ?? "";
  expect(pop3Port).not.toBe("");

  await page.goto("/settings?section=connection");

  const pop3Card = page.locator("section").filter({
    has: page.getByRole("heading", { name: "POP3", exact: true }),
  });
  await expect(pop3Card.getByText(pop3Port, { exact: true })).toBeVisible();
  await expect(
    pop3Card.getByRole("button", { name: "Copy the POP3 host" }),
  ).toBeVisible();
});
