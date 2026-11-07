import { appScreens } from "../e2e/support/app-screens";

/** How the mock answers while a state is read, chosen in the dev toolbar. */
export type DeeperDataState = "normal" | "empty" | "failing";

export type DeeperScreen = {
  path: string;
  title: string;
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

/** Every screen of the app, with the data states its Deeper page covers. */
export const deeperScreens: DeeperScreen[] = appScreens.map((appScreen) => ({
  path: appScreen.path,
  title: appScreen.title,
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
