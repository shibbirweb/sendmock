/**
 * The real SendMock pages the tour shows, captured by
 * `bun run app-pages` (video/scripts/capture-app-pages.ts) into public/app-pages.
 */
export type AppTourPage = {
  pageName: string;
  route: string;
  screenshotPath: string;
  /** Where the slow push in heads, so each page moves a little differently. */
  pushOrigin: string;
};

export const appTourPages: AppTourPage[] = [
  {
    pageName: "Overview",
    route: "/",
    screenshotPath: "app-pages/overview.png",
    pushOrigin: "60% 30%",
  },
  {
    pageName: "Mail",
    route: "/mail",
    screenshotPath: "app-pages/mail.png",
    pushOrigin: "70% 25%",
  },
  {
    pageName: "SMS",
    route: "/sms",
    screenshotPath: "app-pages/sms.png",
    pushOrigin: "80% 20%",
  },
  {
    pageName: "Webhook deliveries",
    route: "/webhooks/deliveries",
    screenshotPath: "app-pages/webhook-deliveries.png",
    pushOrigin: "50% 30%",
  },
  {
    pageName: "Webhook templates",
    route: "/webhooks/templates",
    screenshotPath: "app-pages/webhook-templates.png",
    pushOrigin: "40% 35%",
  },
  {
    pageName: "Payments",
    route: "/payments",
    screenshotPath: "app-pages/payments.png",
    pushOrigin: "55% 30%",
  },
  {
    pageName: "HTTP catcher",
    route: "/http",
    screenshotPath: "app-pages/http-catcher.png",
    pushOrigin: "65% 30%",
  },
  {
    pageName: "Scenarios",
    route: "/scenarios",
    screenshotPath: "app-pages/scenarios.png",
    pushOrigin: "35% 40%",
  },
];
