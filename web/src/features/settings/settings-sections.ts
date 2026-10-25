import {
  BellIcon,
  BellRingIcon,
  DatabaseIcon,
  FlameIcon,
  InfoIcon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  PlugIcon,
  ReceiptIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import type { AppSettings } from "@/lib/api/types";

export const settingsSectionIds = [
  "general",
  "seed",
  "email",
  "sms",
  "payments",
  "notifications",
  "opened-events",
  "chaos",
  "otp",
  "connection",
  "about",
] as const;

export type SettingsSectionId = (typeof settingsSectionIds)[number];

export const settingsSections: {
  sectionId: SettingsSectionId;
  label: string;
  icon: LucideIcon;
}[] = [
  { sectionId: "general", label: "General", icon: SlidersHorizontalIcon },
  { sectionId: "seed", label: "Seed", icon: DatabaseIcon },
  { sectionId: "email", label: "Email", icon: MailIcon },
  { sectionId: "sms", label: "SMS", icon: MessageSquareIcon },
  { sectionId: "payments", label: "Payments", icon: ReceiptIcon },
  { sectionId: "notifications", label: "Notifications", icon: BellIcon },
  { sectionId: "opened-events", label: "Opened events", icon: BellRingIcon },
  { sectionId: "chaos", label: "Chaos", icon: FlameIcon },
  { sectionId: "otp", label: "OTP patterns", icon: KeyRoundIcon },
  { sectionId: "connection", label: "Connection", icon: PlugIcon },
  { sectionId: "about", label: "About", icon: InfoIcon },
];

/** True while any chaos option would change how SendMock answers. */
export function isChaosActive(
  appSettings: Pick<
    AppSettings,
    | "chaos_smtp_reject_next_count"
    | "chaos_smtp_reject_recipient_pattern"
    | "chaos_smtp_command_latency_ms"
    | "is_chaos_smtp_drop_during_data_enabled"
  >,
): boolean {
  return (
    appSettings.chaos_smtp_reject_next_count > 0 ||
    appSettings.chaos_smtp_reject_recipient_pattern !== null ||
    appSettings.chaos_smtp_command_latency_ms > 0 ||
    appSettings.is_chaos_smtp_drop_during_data_enabled
  );
}
