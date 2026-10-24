import type { CreatedBy, IsoTimestamp, Ulid } from "@/lib/api/types/common";

export type VerifyChannel = "sms" | "whatsapp" | "email" | "call";
export type VerificationStatus =
  "pending" | "approved" | "canceled" | "expired" | "max_attempts_reached";

export type VerifyService = {
  sid: string;
  friendly_name: string;
  code_length: number;
  fixed_code: string | null;
  ttl_seconds: number;
  created_by: CreatedBy;
};

export type Verification = {
  sid: string;
  service_sid: string;
  service_name: string;
  to: string;
  channel: VerifyChannel;
  code: string;
  status: VerificationStatus;
  check_attempts: number;
  send_attempts: number;
  expires_at: IsoTimestamp;
  created_at: IsoTimestamp;
  linked_message_id: Ulid | null;
};

export type ForcedVerificationState =
  "approved" | "canceled" | "expired" | "max_attempts";

export type VirtualNumber = {
  id: Ulid;
  number: string;
  label: string;
  channels: ("sms" | "whatsapp")[];
  inbound_url: string | null;
  inbound_template_id: string | null;
  status_callback_url: string | null;
  messaging_service_sid: string | null;
  created_by: CreatedBy;
};

export type MessagingService = {
  sid: string;
  friendly_name: string;
  number_ids: Ulid[];
  created_by: CreatedBy;
};
