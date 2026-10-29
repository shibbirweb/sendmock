import {
  ActivityIcon,
  BookmarkIcon,
  ChartColumnIcon,
  CreditCardIcon,
  FileCode2Icon,
  GaugeIcon,
  GlobeIcon,
  InboxIcon,
  ListChecksIcon,
  ListTodoIcon,
  MailPlusIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  PhoneIcon,
  ReceiptIcon,
  ScrollTextIcon,
  ServerCogIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  VariableIcon,
  LandmarkIcon,
  WalletCardsIcon,
  WorkflowIcon,
  WebhookIcon,
} from "lucide-react";

export type NavigationItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  /** The user guide page for this screen, relative to the docs root. */
  docsPath: string;
  /** The operation the screen lists; until the server serves it, the screen shows Not available yet (UI-12). */
  listOperationKey: string;
  /** One line on what the screen will do, shown while it is not available yet. */
  upcomingDescription: string;
  /** Second key of the "g then key" navigation shortcut, e.g. "m" for "g m". */
  shortcutKey?: string;
  children?: NavigationItem[];
};

/**
 * The single list of app sections. The sidebar, the command palette and the
 * "g then key" shortcuts are all built from it, so they never disagree.
 */
export const navigationItems: NavigationItem[] = [
  {
    title: "Overview",
    path: "/",
    docsPath: "overview/",
    listOperationKey: "GET /api/v1/stats",
    upcomingDescription:
      "Counts, charts and the latest traffic across mail, SMS, webhooks and payments.",
    icon: GaugeIcon,
    shortcutKey: "o",
  },
  {
    title: "Mail",
    path: "/mail",
    docsPath: "mail/",
    listOperationKey: "GET /api/v1/emails",
    upcomingDescription:
      "Every email your app sends, with search, previews and checks.",
    icon: MailIcon,
    shortcutKey: "m",
    children: [
      {
        title: "Inbox",
        path: "/mail",
        docsPath: "mail/",
        listOperationKey: "GET /api/v1/emails",
        upcomingDescription:
          "Every email your app sends, with search, previews and checks.",
        icon: InboxIcon,
      },
      {
        title: "Providers",
        path: "/mail/providers",
        docsPath: "mail/providers/",
        listOperationKey: "GET /api/v1/emails/providers",
        upcomingDescription:
          "SendGrid, Mailgun, Postmark and other email APIs your app can send to, plus your own.",
        icon: ServerCogIcon,
      },
    ],
  },
  {
    title: "SMS",
    path: "/sms",
    docsPath: "sms/",
    listOperationKey: "GET /api/v1/sms",
    upcomingDescription:
      "Every SMS your app sends, in conversations, with delivery statuses.",
    icon: MessageSquareIcon,
    shortcutKey: "s",
    children: [
      {
        title: "Messages",
        path: "/sms",
        docsPath: "sms/",
        listOperationKey: "GET /api/v1/sms",
        upcomingDescription:
          "Every SMS your app sends, in conversations, with delivery statuses.",
        icon: MessagesSquareIcon,
      },
      {
        title: "Verify",
        path: "/sms/verify",
        docsPath: "sms/verify/",
        listOperationKey: "GET /api/v1/verify",
        upcomingDescription:
          "The Twilio Verify codes your app starts and checks.",
        icon: ShieldCheckIcon,
        shortcutKey: "v",
      },
      {
        title: "Providers",
        path: "/sms/providers",
        docsPath: "sms/providers/",
        listOperationKey: "GET /api/v1/sms/providers",
        upcomingDescription:
          "Twilio, Vonage and other SMS APIs your app can send to, plus your own.",
        icon: ServerCogIcon,
      },
    ],
  },
  {
    title: "HTTP Catcher",
    path: "/http",
    docsPath: "http/",
    listOperationKey: "GET /api/v1/http/requests",
    upcomingDescription:
      "Catch any HTTP request your app makes, with bins and canned responses.",
    icon: GlobeIcon,
    shortcutKey: "h",
  },
  {
    title: "Webhooks",
    path: "/webhooks/overview",
    docsPath: "webhooks/",
    listOperationKey: "GET /api/v1/webhooks/metrics",
    upcomingDescription:
      "Webhooks SendMock sends to your app when mail, SMS and payments happen.",
    icon: WebhookIcon,
    shortcutKey: "w",
    children: [
      {
        title: "Overview",
        path: "/webhooks/overview",
        docsPath: "webhooks/",
        listOperationKey: "GET /api/v1/webhooks/metrics",
        upcomingDescription:
          "Webhooks SendMock sends to your app when mail, SMS and payments happen.",
        icon: ChartColumnIcon,
      },
      {
        title: "Endpoints",
        path: "/webhooks/endpoints",
        docsPath: "webhooks/endpoints/",
        listOperationKey: "GET /api/v1/webhooks/endpoints",
        upcomingDescription:
          "The URLs in your app that receive webhooks, with signing secrets.",
        icon: SendIcon,
      },
      {
        title: "Rules",
        path: "/webhooks/rules",
        docsPath: "webhooks/rules/",
        listOperationKey: "GET /api/v1/webhooks/rules",
        upcomingDescription: "Which events go to which endpoint, with filters.",
        icon: ListChecksIcon,
      },
      {
        title: "Inbound routes",
        path: "/webhooks/inbound-routes",
        docsPath: "webhooks/inbound-routes/",
        listOperationKey: "GET /api/v1/inbound-routes",
        upcomingDescription:
          "Incoming email turned into webhooks, Mailgun style.",
        icon: MailPlusIcon,
      },
      {
        title: "Deliveries",
        path: "/webhooks/deliveries",
        docsPath: "webhooks/deliveries/",
        listOperationKey: "GET /api/v1/webhooks/deliveries",
        upcomingDescription:
          "Every webhook attempt with its request, response and retries.",
        icon: ActivityIcon,
        shortcutKey: "d",
      },
      {
        title: "Composer",
        path: "/webhooks/composer",
        docsPath: "webhooks/composer-and-saved/",
        listOperationKey: "POST /api/v1/webhooks/endpoints/{endpointId}/send",
        upcomingDescription: "Write and send a webhook by hand.",
        icon: SquarePenIcon,
      },
      {
        title: "Templates",
        path: "/webhooks/templates",
        docsPath: "webhooks/templates/",
        listOperationKey: "GET /api/v1/webhooks/templates",
        upcomingDescription: "Payload formats for each provider, and your own.",
        icon: FileCode2Icon,
      },
      {
        title: "Variables",
        path: "/webhooks/variables",
        docsPath: "webhooks/variables/",
        listOperationKey: "GET /api/v1/webhooks/variables",
        upcomingDescription:
          "Values your templates share, such as secrets and IDs.",
        icon: VariableIcon,
      },
      {
        title: "Saved",
        path: "/webhooks/saved",
        docsPath: "webhooks/composer-and-saved/",
        listOperationKey: "GET /api/v1/webhooks/saved",
        upcomingDescription: "Webhooks you saved to send again.",
        icon: BookmarkIcon,
      },
    ],
  },
  {
    title: "Payments",
    path: "/payments",
    docsPath: "payments/",
    listOperationKey: "GET /api/v1/payments",
    upcomingDescription:
      "Payments through Stripe, PayPal and other gateways, with a test checkout.",
    icon: CreditCardIcon,
    shortcutKey: "p",
    children: [
      {
        title: "All payments",
        path: "/payments",
        docsPath: "payments/",
        listOperationKey: "GET /api/v1/payments",
        upcomingDescription:
          "Payments through Stripe, PayPal and other gateways, with a test checkout.",
        icon: ReceiptIcon,
      },
      {
        title: "Gateways",
        path: "/payments/gateways",
        docsPath: "payments/gateways/",
        listOperationKey: "GET /api/v1/payments/gateways",
        upcomingDescription:
          "The payment APIs your app talks to, and their credentials.",
        icon: LandmarkIcon,
      },
      {
        title: "Methods",
        path: "/payments/methods",
        docsPath: "payments/methods/",
        listOperationKey: "GET /api/v1/payments/methods",
        upcomingDescription:
          "The cards, wallets and bank methods each gateway offers.",
        icon: WalletCardsIcon,
      },
      {
        title: "Flows",
        path: "/payments/flows",
        docsPath: "payments/flows/",
        listOperationKey: "GET /api/v1/payments/flows",
        upcomingDescription:
          "Step by step checkout flows such as 3-D Secure and redirects.",
        icon: WorkflowIcon,
      },
    ],
  },
  {
    title: "Numbers",
    path: "/numbers",
    docsPath: "numbers/",
    listOperationKey: "GET /api/v1/numbers",
    upcomingDescription:
      "The virtual numbers and Messaging Services your app sends from.",
    icon: PhoneIcon,
    shortcutKey: "n",
  },
  {
    title: "Scenarios",
    path: "/scenarios",
    docsPath: "scenarios/",
    listOperationKey: "POST /api/v1/scenarios/validate",
    upcomingDescription: "Scripted test runs across email, SMS and webhooks.",
    icon: ListTodoIcon,
    shortcutKey: "c",
  },
  {
    title: "Logs",
    path: "/logs",
    docsPath: "logs/",
    listOperationKey: "GET /api/v1/logs/smtp",
    upcomingDescription: "SMTP sessions and API requests.",
    icon: ScrollTextIcon,
    shortcutKey: "l",
  },
  {
    title: "Settings",
    path: "/settings",
    docsPath: "settings/",
    listOperationKey: "GET /api/v1/settings",
    upcomingDescription: "Every runtime setting.",
    icon: SettingsIcon,
    shortcutKey: ",",
  },
];

/** Every item, children included, in display order. */
export function listAllNavigationItems(): NavigationItem[] {
  return navigationItems.flatMap((navigationItem) => [
    navigationItem,
    ...(navigationItem.children ?? []).filter(
      (childItem) => childItem.path !== navigationItem.path,
    ),
  ]);
}
