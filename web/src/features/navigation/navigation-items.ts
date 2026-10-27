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
    icon: GaugeIcon,
    shortcutKey: "o",
  },
  {
    title: "Mail",
    path: "/mail",
    docsPath: "mail/",
    icon: MailIcon,
    shortcutKey: "m",
    children: [
      { title: "Inbox", path: "/mail", docsPath: "mail/", icon: InboxIcon },
      {
        title: "Providers",
        path: "/mail/providers",
        docsPath: "mail/providers/",
        icon: ServerCogIcon,
      },
    ],
  },
  {
    title: "SMS",
    path: "/sms",
    docsPath: "sms/",
    icon: MessageSquareIcon,
    shortcutKey: "s",
    children: [
      {
        title: "Messages",
        path: "/sms",
        docsPath: "sms/",
        icon: MessagesSquareIcon,
      },
      {
        title: "Verify",
        path: "/sms/verify",
        docsPath: "sms/verify/",
        icon: ShieldCheckIcon,
        shortcutKey: "v",
      },
      {
        title: "Providers",
        path: "/sms/providers",
        docsPath: "sms/providers/",
        icon: ServerCogIcon,
      },
    ],
  },
  {
    title: "HTTP Catcher",
    path: "/http",
    docsPath: "http/",
    icon: GlobeIcon,
    shortcutKey: "h",
  },
  {
    title: "Webhooks",
    path: "/webhooks/overview",
    docsPath: "webhooks/",
    icon: WebhookIcon,
    shortcutKey: "w",
    children: [
      {
        title: "Overview",
        path: "/webhooks/overview",
        docsPath: "webhooks/",
        icon: ChartColumnIcon,
      },
      {
        title: "Endpoints",
        path: "/webhooks/endpoints",
        docsPath: "webhooks/endpoints/",
        icon: SendIcon,
      },
      {
        title: "Rules",
        path: "/webhooks/rules",
        docsPath: "webhooks/rules/",
        icon: ListChecksIcon,
      },
      {
        title: "Inbound routes",
        path: "/webhooks/inbound-routes",
        docsPath: "webhooks/inbound-routes/",
        icon: MailPlusIcon,
      },
      {
        title: "Deliveries",
        path: "/webhooks/deliveries",
        docsPath: "webhooks/deliveries/",
        icon: ActivityIcon,
        shortcutKey: "d",
      },
      {
        title: "Composer",
        path: "/webhooks/composer",
        docsPath: "webhooks/composer-and-saved/",
        icon: SquarePenIcon,
      },
      {
        title: "Templates",
        path: "/webhooks/templates",
        docsPath: "webhooks/templates/",
        icon: FileCode2Icon,
      },
      {
        title: "Variables",
        path: "/webhooks/variables",
        docsPath: "webhooks/variables/",
        icon: VariableIcon,
      },
      {
        title: "Saved",
        path: "/webhooks/saved",
        docsPath: "webhooks/composer-and-saved/",
        icon: BookmarkIcon,
      },
    ],
  },
  {
    title: "Payments",
    path: "/payments",
    docsPath: "payments/",
    icon: CreditCardIcon,
    shortcutKey: "p",
    children: [
      {
        title: "All payments",
        path: "/payments",
        docsPath: "payments/",
        icon: ReceiptIcon,
      },
      {
        title: "Gateways",
        path: "/payments/gateways",
        docsPath: "payments/gateways/",
        icon: LandmarkIcon,
      },
      {
        title: "Methods",
        path: "/payments/methods",
        docsPath: "payments/methods/",
        icon: WalletCardsIcon,
      },
      {
        title: "Flows",
        path: "/payments/flows",
        docsPath: "payments/flows/",
        icon: WorkflowIcon,
      },
    ],
  },
  {
    title: "Numbers",
    path: "/numbers",
    docsPath: "numbers/",
    icon: PhoneIcon,
    shortcutKey: "n",
  },
  {
    title: "Scenarios",
    path: "/scenarios",
    docsPath: "scenarios/",
    icon: ListTodoIcon,
    shortcutKey: "c",
  },
  {
    title: "Logs",
    path: "/logs",
    docsPath: "logs/",
    icon: ScrollTextIcon,
    shortcutKey: "l",
  },
  {
    title: "Settings",
    path: "/settings",
    docsPath: "settings/",
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
