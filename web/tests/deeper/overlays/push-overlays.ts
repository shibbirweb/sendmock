import { expect, type Page } from "@playwright/test";

import type { DeeperOverlay } from "../deeper-screens";

/** The demo's OneSignal notification, which has an image and targets iOS. */
async function openNotification(page: Page) {
  await page.getByRole("link", { name: "Flash sale" }).click();
  await expect(
    page.getByRole("dialog", { name: "Push notification" }),
  ).toBeVisible();
}

export const pushOverlays: DeeperOverlay[] = [
  { name: "A notification is open", open: openNotification, scope: "dialog" },
  {
    name: "Clear all dialog",
    open: async (page) => {
      await page.getByRole("button", { name: "Clear all" }).click();
    },
    scope: "dialog",
  },
];
