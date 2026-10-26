import type { Page } from "@playwright/test";

/** Every screen of the app with its browser tab title (UI-07.4). */
export const appScreens = [
  { path: "/", title: "Overview · SendMock" },
  { path: "/mail", title: "Mail · SendMock" },
  { path: "/sms", title: "SMS · SendMock" },
  { path: "/sms/verify", title: "Verify · SendMock" },
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
  { path: "/scenarios", title: "Scenarios · SendMock" },
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
