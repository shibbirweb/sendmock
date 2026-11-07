import { expect, type Page } from "@playwright/test";

import type { DeeperOverlay } from "../deeper-screens";

/** The demo newsletter: HTML, a text part and an attachment, so most tabs show. */
async function openNewsletterEmail(page: Page) {
  await page
    .getByRole("link", { name: /Welcome to Acme/ })
    .first()
    .click();
  await expect(page.getByRole("tab", { name: "HTML" })).toBeVisible();
}

/** The demo sign-up email, whose code and link show in the extracted data panel. */
async function openCodeEmail(page: Page) {
  await page
    .getByRole("link", { name: /Your verification code/ })
    .first()
    .click();
  await expect(page.getByRole("tab", { name: "Text" })).toBeVisible();
}

async function openEmailTab(page: Page, tabName: string) {
  await openNewsletterEmail(page);
  await page.getByRole("tab", { name: tabName }).click();
  await expect(page.getByRole("tab", { name: tabName })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

const emailTabNames = [
  "HTML",
  "Text",
  "Source",
  "Headers",
  "Attachments (1)",
  "MIME",
  "Checks",
  "Timeline",
  "Template data",
];

export const mailOverlays: DeeperOverlay[] = [
  { name: "An email is open", open: openNewsletterEmail, scope: "screen" },
  {
    name: "An email with a code is open",
    open: openCodeEmail,
    scope: "screen",
    baseline: "An email is open",
  },
  ...emailTabNames.map((tabName): DeeperOverlay => ({
    name: `${tabName.replace(/ \(\d+\)$/, "")} tab`,
    open: (page) => openEmailTab(page, tabName),
    scope: "screen",
    baseline: "An email is open",
  })),
  {
    name: "Replying",
    open: async (page) => {
      await openNewsletterEmail(page);
      await page.getByRole("button", { name: "Reply", exact: true }).click();
    },
    scope: "screen",
    baseline: "An email is open",
  },
  {
    name: "Simulate an event menu",
    open: async (page) => {
      await openNewsletterEmail(page);
      await page.getByRole("button", { name: "Simulate an event" }).click();
    },
    scope: "menu",
  },
  {
    name: "More actions menu",
    open: async (page) => {
      await openNewsletterEmail(page);
      await page.getByRole("button", { name: "More actions" }).click();
    },
    scope: "menu",
  },
  {
    name: "Release dialog",
    open: async (page) => {
      await openNewsletterEmail(page);
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: /Release/ }).click();
    },
    scope: "dialog",
  },
  {
    name: "Send to webhook dialog",
    open: async (page) => {
      await openNewsletterEmail(page);
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: /webhook/i }).click();
    },
    scope: "dialog",
  },
  {
    name: "Import .eml dialog",
    open: (page) => page.getByRole("button", { name: "Import .eml" }).click(),
    scope: "dialog",
  },
  {
    name: "Delete all emails dialog",
    open: (page) =>
      page.getByRole("button", { name: "Delete all emails" }).click(),
    scope: "dialog",
  },
];

/** The SendGrid provider, a built-in with every tab filled in. */
async function openProviderEditor(page: Page) {
  await page.getByRole("button", { name: "SendGrid" }).first().click();
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
}

const providerTabNames = [
  "Requests",
  "Responses",
  "Callbacks",
  "Preview",
  "Try it",
];

/** Mail > Providers and the SMS one share the provider editor. */
export const mailProvidersOverlays: DeeperOverlay[] = [
  {
    name: "Add a provider dialog",
    open: (page) => page.getByRole("button", { name: "Add provider" }).click(),
    scope: "dialog",
  },
  {
    name: "Provider editor, General tab",
    open: openProviderEditor,
    scope: "dialog",
  },
  ...providerTabNames.map((tabName): DeeperOverlay => ({
    name: `Provider editor, ${tabName} tab`,
    open: async (page) => {
      await openProviderEditor(page);
      await page.getByRole("tab", { name: tabName }).click();
    },
    scope: "dialog",
    baseline: "Provider editor, General tab",
  })),
];
