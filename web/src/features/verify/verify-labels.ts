import {
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PhoneIcon,
} from "lucide-react";

import type {
  ForcedVerificationState,
  VerificationStatus,
  VerificationTimelineKind,
  VerifyChannel,
} from "@/lib/api/types";

export const verifyChannelLabels: Record<VerifyChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  call: "Call",
};

export const verifyChannelIcons: Record<VerifyChannel, LucideIcon> = {
  sms: MessageSquareIcon,
  whatsapp: MessageCircleIcon,
  email: MailIcon,
  call: PhoneIcon,
};

export const verificationStatusLabels: Record<VerificationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  canceled: "Canceled",
  expired: "Expired",
  max_attempts_reached: "Max attempts",
};

export const verificationTimelineLabels: Record<
  VerificationTimelineKind,
  string
> = {
  started: "Started",
  code_sent: "Code sent",
  check_failed: "Wrong code",
  approved: "Approved",
  canceled: "Canceled",
  expired: "Expired",
  max_attempts_reached: "Max attempts reached",
};

/** Force buttons in the drawer, in the order they are shown. */
export const forcedStateActions: {
  forcedState: ForcedVerificationState;
  label: string;
}[] = [
  { forcedState: "approved", label: "Approve" },
  { forcedState: "canceled", label: "Cancel" },
  { forcedState: "expired", label: "Expire" },
  { forcedState: "max_attempts", label: "Max attempts" },
];

export type VerificationStatusFilter =
  "all" | "pending" | "approved" | "failed";

/** Status chips above the table; Failed groups the three ways to fail. */
export const verificationStatusFilters: {
  statusFilter: VerificationStatusFilter;
  label: string;
  statuses: VerificationStatus[] | null;
}[] = [
  { statusFilter: "all", label: "All", statuses: null },
  { statusFilter: "pending", label: "Pending", statuses: ["pending"] },
  { statusFilter: "approved", label: "Approved", statuses: ["approved"] },
  {
    statusFilter: "failed",
    label: "Failed",
    statuses: ["canceled", "expired", "max_attempts_reached"],
  },
];
