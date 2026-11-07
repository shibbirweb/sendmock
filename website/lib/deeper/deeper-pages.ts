import type { DeeperPage } from "./deeper-types";
import { appShellPage } from "./screens/app-shell";
import { mailInboxPage } from "./screens/mail-inbox";
import { mailProvidersPage } from "./screens/mail-providers";
import { smsMessagesPage } from "./screens/sms-messages";
import { smsProvidersPage } from "./screens/sms-providers";
import { smsVerifyPage } from "./screens/sms-verify";
import {
  webhooksComposerPage,
  webhooksSavedPage,
} from "./screens/webhooks-composer-saved";
import { webhooksDeliveriesPage } from "./screens/webhooks-deliveries";
import { webhooksEndpointsPage } from "./screens/webhooks-endpoints";
import { webhooksInboundRoutesPage } from "./screens/webhooks-inbound-routes";
import { webhooksOverviewPage } from "./screens/webhooks-overview";
import { webhooksRulesPage } from "./screens/webhooks-rules";
import {
  webhooksTemplatesPage,
  webhooksVariablesPage,
} from "./screens/webhooks-templates-variables";

/** Every Deeper page written so far (W14c onward adds a menu at a time). */
export const deeperPages: DeeperPage[] = [
  appShellPage,
  mailInboxPage,
  mailProvidersPage,
  smsMessagesPage,
  smsVerifyPage,
  smsProvidersPage,
  webhooksOverviewPage,
  webhooksEndpointsPage,
  webhooksRulesPage,
  webhooksInboundRoutesPage,
  webhooksDeliveriesPage,
  webhooksComposerPage,
  webhooksTemplatesPage,
  webhooksVariablesPage,
  webhooksSavedPage,
];

/** Screens of the inventory whose page is not written yet; the list only shrinks. */
export const pendingDeeperScreens = [
  "/",
  "/http",
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
