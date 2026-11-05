import { expect, type Page, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

const capturedRows = (page: Page) => page.getByTestId("captured-request");

async function openBin(page: Page, binName: string) {
  await page
    .getByRole("navigation", { name: "Bin list" })
    // The name, then a space: another bin's name can start with this one's.
    .getByRole("button", { name: new RegExp(`^${binName} `) })
    .click();
  await expect(page.getByRole("heading", { name: binName })).toBeVisible();
}

test("HC-01.6 live bins list their captured requests, and are added, cleared and deleted", async ({
  page,
  request,
}) => {
  const binName = `live-orders-${test.info().retry + 1}`;
  await request.post(`/catch/${binName}/hooks?id=7`, {
    data: { event: "paid" },
  });
  const failedApiCalls = watchFailedApiCalls(page);

  await page.goto("/http");
  await openBin(page, binName);
  await expect(capturedRows(page)).toHaveCount(1);
  await expect(capturedRows(page).first()).toContainText("POST");

  await page.getByRole("button", { name: "New bin" }).click();
  const newBinDialog = page.getByRole("dialog", { name: "New bin" });
  const addedBinName = `${binName}-discord`;
  await newBinDialog.getByLabel("Name").fill(addedBinName);
  await newBinDialog.getByRole("combobox", { name: "Preset" }).click();
  await page.getByRole("option", { name: "Discord webhook" }).click();
  await newBinDialog.getByRole("button", { name: "Add bin" }).click();
  await expect(page.getByRole("heading", { name: addedBinName })).toBeVisible();
  await page.getByRole("button", { name: "Delete bin" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await openBin(page, binName);
  await page.getByRole("button", { name: "Clear requests" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Clear requests" })
    .click();
  await expect(page.getByText(`No requests in ${binName} yet.`)).toBeVisible();
  expect(failedApiCalls).toEqual([]);
});
