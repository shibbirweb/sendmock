import {
  ActivityIcon,
  BookmarkIcon,
  FileCode2Icon,
  GaugeIcon,
  GlobeIcon,
  ListChecksIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneIcon,
  ScrollTextIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  VariableIcon,
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
    path: "/webhooks/endpoints",
    icon: WebhookIcon,
    shortcutKey: "w",
    children: [
      { title: "Endpoints", path: "/webhooks/endpoints", icon: SendIcon },
      { title: "Rules", path: "/webhooks/rules", icon: ListChecksIcon },
      {
        title: "Deliveries",
        path: "/webhooks/deliveries",
        icon: ActivityIcon,
        shortcutKey: "d",
      },
      { title: "Templates", path: "/webhooks/templates", icon: FileCode2Icon },
      { title: "Variables", path: "/webhooks/variables", icon: VariableIcon },
      { title: "Saved", path: "/webhooks/saved", icon: BookmarkIcon },
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
