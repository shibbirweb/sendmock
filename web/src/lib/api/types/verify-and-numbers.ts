import type {
  CreatedBy,
  IsoTimestamp,
  PageRequest,
  Ulid,
} from "@/lib/api/types/common";

export type VerifyChannel = "sms" | "whatsapp" | "email" | "call";
export type VerificationStatus =
  "pending" | "approved" | "canceled" | "expired" | "max_attempts_reached";

/** Twilio Verify allows this many wrong checks before failing with 60202. */
export const maxVerificationCheckAttempts = 5;

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
  /** The captured SMS or email that carried the code; null for `call`. */
  linked_message_id: Ulid | null;
  /** Conversation of the linked SMS, for the "Open message" link. */
  linked_thread_id: string | null;
};

export type VerificationTimelineKind =
  | "started"
  | "code_sent"
  | "check_failed"
  | "approved"
  | "canceled"
  | "expired"
  | "max_attempts_reached";

export type VerificationTimelineEntry = {
  kind: VerificationTimelineKind;
  at: IsoTimestamp;
  detail: string;
};

export type VerificationDetail = Verification & {
  timeline: VerificationTimelineEntry[];
};

/** Query of GET /api/v1/verify; `status` takes a comma-separated list. */
export type VerificationListFilters = PageRequest & {
  status?: string;
  to?: string;
  channel?: VerifyChannel;
};

/** Body of POST and PATCH /api/v1/verify/services. */
export type VerifyServiceInput = Pick<
  VerifyService,
  "friendly_name" | "code_length" | "fixed_code" | "ttl_seconds"
>;

export type ForcedVerificationState =
  "approved" | "canceled" | "expired" | "max_attempts";

export type NumberChannel = "sms" | "whatsapp";
export type InboundWebhookMethod = "POST" | "GET";

export type VirtualNumber = {
  id: Ulid;
  /** E.164, without a channel prefix; `channels` says whether WhatsApp works. */
  number: string;
  label: string;
  channels: NumberChannel[];
  /** Reply webhook (Twilio "A message comes in"); null means rules only. */
  inbound_url: string | null;
  inbound_method: InboundWebhookMethod;
  inbound_fallback_url: string | null;
  /** Payload template for the inbound webhook, e.g. `twilio.inbound_sms`. */
  inbound_template_id: string | null;
  status_callback_url: string | null;
  messaging_service_sid: string | null;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/numbers. */
export type VirtualNumberInput = Omit<VirtualNumber, "id" | "created_by">;

/** What a Messaging Service does with inbound messages to its numbers. */
export type MessagingServiceInboundMode =
  "webhook" | "defer_to_sender" | "drop";

export type MessagingService = {
  sid: string;
  friendly_name: string;
  number_ids: Ulid[];
  inbound_mode: MessagingServiceInboundMode;
  /** Used when `inbound_mode` is `webhook`. */
  inbound_url: string | null;
  inbound_fallback_url: string | null;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/messaging-services. */
export type MessagingServiceInput = Omit<
  MessagingService,
  "sid" | "created_by"
>;
