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
  /**
   * The service SID, `VA...`.
   * @example "VA00000000000000000000000000000001"
   */
  sid: string;
  /**
   * The name shown in the code message, e.g. "Your Shop verification code is ...".
   * @example "Shop"
   */
  friendly_name: string;
  /**
   * Digits in each code, 4 to 10.
   * @example 6
   */
  code_length: number;
  /**
   * Always send this code instead of a random one, for deterministic tests; null for random.
   * @example "123456"
   */
  fixed_code: string | null;
  /**
   * How long a code stays valid, in seconds.
   * @example 600
   */
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
  /**
   * E.164, without a channel prefix; `channels` says whether WhatsApp works.
   * @example "+15550001111"
   */
  number: string;
  /**
   * A name for the number, e.g. the app or feature that uses it.
   * @example "Support line"
   */
  label: string;
  /**
   * Where the number works: `sms`, `whatsapp` or both.
   * @example ["sms"]
   */
  channels: NumberChannel[];
  /**
   * Reply webhook (Twilio "A message comes in"); null means rules only.
   * @example "http://localhost:3000/sms/inbound"
   */
  inbound_url: string | null;
  /**
   * The HTTP method of the reply webhook.
   * @example "POST"
   */
  inbound_method: InboundWebhookMethod;
  /**
   * Called when the reply webhook fails, with `ErrorCode` and `ErrorUrl` added, as Twilio does.
   * @example "http://localhost:3000/sms/inbound-fallback"
   */
  inbound_fallback_url: string | null;
  /**
   * Payload template for the inbound webhook, e.g. `twilio.inbound_sms`.
   * @example "twilio.inbound_sms"
   */
  inbound_template_id: string | null;
  /**
   * Your app's URL for status changes of messages sent from this number.
   * @example "http://localhost:3000/sms/status"
   */
  status_callback_url: string | null;
  /**
   * The Messaging Service this number belongs to, `MG...`; null for none.
   * @example "MG00000000000000000000000000000001"
   */
  messaging_service_sid: string | null;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/numbers. */
export type VirtualNumberInput = Omit<VirtualNumber, "id" | "created_by">;

/** What a Messaging Service does with inbound messages to its numbers. */
export type MessagingServiceInboundMode =
  "webhook" | "defer_to_sender" | "drop";

export type MessagingService = {
  /**
   * The service SID, `MG...`.
   * @example "MG00000000000000000000000000000001"
   */
  sid: string;
  /**
   * A name for the service.
   * @example "Notifications"
   */
  friendly_name: string;
  /**
   * The virtual numbers in the sender pool, by ID.
   * @example ["01JB7T9Q2R5W8X3Y6Z1A4B7C9D"]
   */
  number_ids: Ulid[];
  /**
   * What happens to inbound messages: `webhook` (call `inbound_url`), `defer_to_sender` (each number's own webhook) or `drop`.
   * @example "webhook"
   */
  inbound_mode: MessagingServiceInboundMode;
  /**
   * Used when `inbound_mode` is `webhook`.
   * @example "http://localhost:3000/sms/inbound"
   */
  inbound_url: string | null;
  /**
   * Called when `inbound_url` fails.
   * @example "http://localhost:3000/sms/inbound-fallback"
   */
  inbound_fallback_url: string | null;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/messaging-services. */
export type MessagingServiceInput = Omit<
  MessagingService,
  "sid" | "created_by"
>;

/** Body of `POST /verify/{verificationSid}/force`. */
export type VerificationForceRequest = {
  /**
   * The state to force: `approved`, `canceled`, `expired` or `max_attempts` (too many wrong checks).
   * @example "expired"
   */
  state: ForcedVerificationState;
};
