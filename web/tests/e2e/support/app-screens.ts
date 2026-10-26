import type { Page } from "@playwright/test";

/** Every screen of the app with its browser tab title (UI-07.4); `loadsDataOnOpen` is false for a screen with no load state. */
export const appScreens = [
  { path: "/", title: "Overview · SendMock" },
  { path: "/mail", title: "Mail · SendMock" },
  { path: "/mail/providers", title: "Providers · Mail · SendMock" },
  { path: "/sms", title: "SMS · SendMock" },
  { path: "/sms/verify", title: "Verify · SendMock" },
  { path: "/sms/providers", title: "Providers · SMS · SendMock" },
  { path: "/http", title: "HTTP Catcher · SendMock" },
  { path: "/webhooks/overview", title: "Overview · Webhooks · SendMock" },
  { path: "/webhooks/endpoints", title: "Endpoints · Webhooks · SendMock" },
  { path: "/webhooks/rules", title: "Rules · Webhooks · SendMock" },
  {
    path: "/webhooks/inbound-routes",
    title: "Inbound routes · Webhooks · SendMock",
  },
  { path: "/webhooks/deliveries", title: "Deliveries · Webhooks · SendMock" },
  { path: "/webhooks/composer", title: "Composer · Webhooks · SendMock" },
  { path: "/webhooks/templates", title: "Templates · Webhooks · SendMock" },
  { path: "/webhooks/variables", title: "Variables · Webhooks · SendMock" },
  { path: "/webhooks/saved", title: "Saved deliveries · Webhooks · SendMock" },
  { path: "/payments", title: "Payments · SendMock" },
  { path: "/payments/gateways", title: "Gateways · Payments · SendMock" },
  { path: "/payments/methods", title: "Methods · Payments · SendMock" },
  { path: "/payments/flows", title: "Flows · Payments · SendMock" },
  { path: "/numbers", title: "Numbers · SendMock" },
  // Loads nothing when it opens: the API is called by Validate and Run.
  { path: "/scenarios", title: "Scenarios · SendMock", loadsDataOnOpen: false },
  { path: "/logs", title: "Logs · SendMock" },
  { path: "/settings", title: "General · Settings · SendMock" },
];

/** Client-side navigation, so the mock state and realtime stream carry over. */
export async function navigateInApp(page: Page, targetPath: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, targetPath);
}
