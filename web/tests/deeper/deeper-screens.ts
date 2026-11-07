import type { Page } from "@playwright/test";

import { appScreens } from "../e2e/support/app-screens";
import { buildProvidersOverlays, mailOverlays } from "./overlays/mail-overlays";
import { smsOverlays, verifyOverlays } from "./overlays/sms-overlays";
import {
  inboundRouteOverlays,
  savedDeliveryOverlays,
  webhookDeliveryOverlays,
  webhookEndpointOverlays,
  webhookOverviewOverlays,
  webhookRuleOverlays,
  webhookTemplateOverlays,
  webhookVariableOverlays,
} from "./overlays/webhook-overlays";

/** How the mock answers while a state is read, chosen in the dev toolbar. */
export type DeeperDataState = "normal" | "empty" | "failing";

/** A tab, pane, dialog or menu opened on a screen, read as a state of its own. */
export type DeeperOverlay = {
  /** The state's heading on the Deeper page, such as "An email is open". */
  name: string;
  /** Steps from the screen as it first loads. */
  open: (page: Page) => Promise<void>;
  /** The screen itself (only what the steps added is recorded), or the dialog or menu. */
  scope: "screen" | "dialog" | "menu";
  /** An earlier overlay whose controls are left out, so a tab lists what the tab adds. */
  baseline?: string;
};

export type DeeperScreen = {
  path: string;
  title: string;
  overlays: DeeperOverlay[];
  /** The data states read beside `normal`; each records only what it adds. */
  extraDataStates: DeeperDataState[];
};

/** The screens whose empty data set shows something of its own (traffic screens). */
const trafficScreenPaths = new Set([
  "/",
  "/mail",
  "/sms",
  "/sms/verify",
  "/http",
  "/webhooks/overview",
  "/webhooks/deliveries",
  "/webhooks/saved",
  "/payments",
  "/payments/subscriptions",
  "/logs",
]);

const overlaysByPath: Record<string, DeeperOverlay[]> = {
  "/mail": mailOverlays,
  "/mail/providers": buildProvidersOverlays("SendGrid"),
  "/sms": smsOverlays,
  "/sms/verify": verifyOverlays,
  "/sms/providers": buildProvidersOverlays("Twilio"),
  "/webhooks/overview": webhookOverviewOverlays,
  "/webhooks/endpoints": webhookEndpointOverlays,
  "/webhooks/rules": webhookRuleOverlays,
  "/webhooks/inbound-routes": inboundRouteOverlays,
  "/webhooks/deliveries": webhookDeliveryOverlays,
  "/webhooks/templates": webhookTemplateOverlays,
  "/webhooks/variables": webhookVariableOverlays,
  "/webhooks/saved": savedDeliveryOverlays,
};

/** Every screen of the app, with the data states and overlays its Deeper page covers. */
export const deeperScreens: DeeperScreen[] = appScreens.map((appScreen) => ({
  path: appScreen.path,
  title: appScreen.title,
  overlays: overlaysByPath[appScreen.path] ?? [],
  extraDataStates: [
    ...(trafficScreenPaths.has(appScreen.path) ? (["empty"] as const) : []),
    ...(appScreen.loadsDataOnOpen === false ? [] : (["failing"] as const)),
  ],
}));

/** The demo toolbar's labels for each data state. */
export const dataStateChoices: Record<
  DeeperDataState,
  { apiResponses: string; dataSet: string }
> = {
  normal: { apiResponses: "Normal", dataSet: "Standard demo data" },
  empty: { apiResponses: "Normal", dataSet: "Empty (no traffic)" },
  failing: {
    apiResponses: "Always 500 server error",
    dataSet: "Standard demo data",
  },
};
