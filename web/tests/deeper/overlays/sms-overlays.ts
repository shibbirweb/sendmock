import { expect, type Page } from "@playwright/test";

import type { DeeperOverlay } from "../deeper-screens";

/** A demo conversation with sent messages and their status callbacks. */
async function openConversation(page: Page) {
  await page.getByText("+15005550101", { exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Message actions" }).first(),
  ).toBeVisible();
}

async function openMessageDetails(page: Page) {
  await openConversation(page);
  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();
  await expect(
    page.getByRole("dialog", { name: "Message details" }),
  ).toBeVisible();
}

const messageDetailTabs = ["Request", "Callbacks"];

export const smsOverlays: DeeperOverlay[] = [
  { name: "A conversation is open", open: openConversation, scope: "screen" },
  {
    name: "Message actions menu",
    open: async (page) => {
      await openConversation(page);
      await page
        .getByRole("button", { name: "Message actions" })
        .first()
        .click();
    },
    scope: "menu",
  },
  {
    name: "Message details, Status tab",
    open: openMessageDetails,
    scope: "dialog",
  },
  ...messageDetailTabs.map((tabName): DeeperOverlay => ({
    name: `Message details, ${tabName} tab`,
    open: async (page) => {
      await openMessageDetails(page);
      await page.getByRole("tab", { name: new RegExp(`^${tabName}`) }).click();
    },
    scope: "dialog",
    baseline: "Message details, Status tab",
  })),
];

async function openVerification(page: Page) {
  await page.locator("tbody").getByRole("link").first().click();
  await expect(
    page.getByRole("dialog", { name: "Verification" }),
  ).toBeVisible();
}

async function openServicesTab(page: Page) {
  await page.getByRole("tab", { name: "Services" }).click();
  await expect(page.getByRole("button", { name: "New service" })).toBeVisible();
}

export const verifyOverlays: DeeperOverlay[] = [
  { name: "A verification is open", open: openVerification, scope: "dialog" },
  { name: "Services tab", open: openServicesTab, scope: "screen" },
  {
    name: "New Verify service dialog",
    open: async (page) => {
      await openServicesTab(page);
      await page.getByRole("button", { name: "New service" }).click();
    },
    scope: "dialog",
  },
];
