import type { DeeperPage } from "./deeper-types";
import { appShellPage } from "./screens/app-shell";
import { mailInboxPage } from "./screens/mail-inbox";

/** Every Deeper page written so far (W14c onward adds a menu at a time). */
export const deeperPages: DeeperPage[] = [appShellPage, mailInboxPage];

/** Screens of the inventory whose page is not written yet; the list only shrinks. */
export const pendingDeeperScreens = [
  "/",
  "/mail/providers",
  "/sms",
  "/sms/verify",
  "/sms/providers",
  "/http",
  "/webhooks/overview",
  "/webhooks/endpoints",
  "/webhooks/rules",
  "/webhooks/inbound-routes",
  "/webhooks/deliveries",
  "/webhooks/composer",
  "/webhooks/templates",
  "/webhooks/variables",
  "/webhooks/saved",
  "/payments",
  "/payments/gateways",
  "/payments/methods",
  "/payments/flows",
  "/payments/subscriptions",
  "/numbers",
  "/scenarios",
  "/logs",
  "/api-reference",
  "/settings",
];
