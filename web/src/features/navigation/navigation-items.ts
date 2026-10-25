import {
  ActivityIcon,
  BookmarkIcon,
  ChartColumnIcon,
  CreditCardIcon,
  FileCode2Icon,
  GaugeIcon,
  GlobeIcon,
  ListChecksIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneIcon,
  ReceiptIcon,
  ScrollTextIcon,
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
  /** Second key of the "g then key" navigation shortcut, e.g. "m" for "g m". */
  shortcutKey?: string;
  children?: NavigationItem[];
};

/**
 * The single list of app sections. The sidebar, the command palette and the
 * "g then key" shortcuts are all built from it, so they never disagree.
 */
export const navigationItems: NavigationItem[] = [
  { title: "Overview", path: "/", icon: GaugeIcon, shortcutKey: "o" },
  { title: "Mail", path: "/mail", icon: MailIcon, shortcutKey: "m" },
  {
    title: "SMS",
    path: "/sms",
    icon: MessageSquareIcon,
    shortcutKey: "s",
    children: [
      {
        title: "Verify",
        path: "/sms/verify",
        icon: ShieldCheckIcon,
        shortcutKey: "v",
      },
    ],
  },
  { title: "HTTP", path: "/http", icon: GlobeIcon, shortcutKey: "h" },
  {
    title: "Webhooks",
    path: "/webhooks/overview",
    icon: WebhookIcon,
    shortcutKey: "w",
    children: [
      {
        title: "Overview",
        path: "/webhooks/overview",
        icon: ChartColumnIcon,
      },
      { title: "Endpoints", path: "/webhooks/endpoints", icon: SendIcon },
      { title: "Rules", path: "/webhooks/rules", icon: ListChecksIcon },
      {
        title: "Deliveries",
        path: "/webhooks/deliveries",
        icon: ActivityIcon,
        shortcutKey: "d",
      },
      { title: "Composer", path: "/webhooks/composer", icon: SquarePenIcon },
      { title: "Templates", path: "/webhooks/templates", icon: FileCode2Icon },
      { title: "Variables", path: "/webhooks/variables", icon: VariableIcon },
      { title: "Saved", path: "/webhooks/saved", icon: BookmarkIcon },
    ],
  },
  {
    title: "Payments",
    path: "/payments",
    icon: CreditCardIcon,
    shortcutKey: "p",
    children: [
      { title: "All payments", path: "/payments", icon: ReceiptIcon },
      { title: "Gateways", path: "/payments/gateways", icon: LandmarkIcon },
      { title: "Methods", path: "/payments/methods", icon: WalletCardsIcon },
      { title: "Flows", path: "/payments/flows", icon: WorkflowIcon },
    ],
  },
  { title: "Numbers", path: "/numbers", icon: PhoneIcon, shortcutKey: "n" },
  { title: "Logs", path: "/logs", icon: ScrollTextIcon, shortcutKey: "l" },
  {
    title: "Settings",
    path: "/settings",
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
