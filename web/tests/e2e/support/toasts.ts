import type { Page } from "@playwright/test";

/**
 * Clicks an action button of the toast with this title, as a user does: the pointer first
 * rests on the stack, which spreads the toasts out, so a newer toast (such as a live
 * "Incoming email") no longer covers the one with the action.
 */
export async function clickToastAction(
  page: Page,
  toastTitle: string,
  actionName: string,
) {
  const actionToast = page.locator("[data-sonner-toast]", {
    hasText: toastTitle,
  });
  await actionToast.waitFor();
  // Forced, because a newer toast may lie on top until the stack spreads out.
  await actionToast.hover({ force: true });
  await actionToast.getByRole("button", { name: actionName }).click();
}
