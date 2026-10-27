import type {
  EmailAddress,
  ExtractedData,
  IsoTimestamp,
  PageRequest,
  Ulid,
} from "@/lib/api/types/common";

/** How the message reached SendMock. */
/** How an email reached SendMock without a provider's API. */
export type EmailTransportSource =
  "smtp" | "sendmail" | "native_api" | "verify" | "simulated";

/**
 * How an email reached SendMock: a transport (`smtp`, `sendmail`, `native_api`,
 * `verify`, `simulated`) or the key of the email provider whose API it was
 * sent through (`sendgrid`, or a custom provider's key; docs/plan/22).
 * @example "sendgrid"
 */
export type EmailSource = string;

/** `outbound`: mail your app sent; `inbound`: mail coming in to your app. */
export type EmailDirection = "outbound" | "inbound";

/** How the recipient answered an email your app sent. */
export type EmailResponseKind = "reply" | "forward";

/** Points from an original email to a reply or forward, or back. */
export type EmailResponseLink = {
  kind: EmailResponseKind;
  email_id: Ulid;
  subject: string;
  from: EmailAddress;
  received_at: IsoTimestamp;
};

/** Simulated delivery outcome, null when no outcome was simulated. */
export type EmailDeliveryStatus =
  "delivered" | "deferred" | "bounced" | "complained" | "unsubscribed";

export type EmailAttachment = {
  index: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  content_id: string | null;
  is_inline: boolean;
  download_url: string;
  thumbnail_url: string | null;
};

/** Fields shown in the mail list. */
export type EmailSummary = {
  id: Ulid;
  received_at: IsoTimestamp;
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  snippet: string;
  size_bytes: number;
  attachment_count: number;
  is_read: boolean;
  tags: string[];
  source: EmailSource;
  delivery_status: EmailDeliveryStatus | null;
  open_count: number;
  has_otp: boolean;
  direction: EmailDirection;
  /** Set on inbound emails made by Reply or Forward, for the list icon. */
  response_kind: EmailResponseKind | null;
};

export type EmailTemplateData = {
  template_id: string;
  template_data: Record<string, unknown>;
};

export type EmailDetail = EmailSummary & {
  message_id: string | null;
  cc: EmailAddress[];
  bcc: EmailAddress[];
  reply_to: EmailAddress[];
  envelope_from: string;
  envelope_to: string[];
  headers: Record<string, string[]>;
  text_body: string | null;
  html_body: string | null;
  attachments: EmailAttachment[];
  extracted: ExtractedData;
  opened_at: IsoTimestamp | null;
  smtp_session_id: Ulid | null;
  smtp_auth_user: string | null;
  template: EmailTemplateData | null;
  /** On a reply or forward: the original email it answers. */
  response_to: EmailResponseLink | null;
  /** On an original: the replies and forwards made from it, oldest first. */
  responses: EmailResponseLink[];
};

export type EmailTimelineKind =
  | "received"
  | "opened"
  | "delivered"
  | "deferred"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "released"
  | "forwarded"
  | "replied"
  | "forwarded_by_recipient"
  | "webhook_sent";

export type EmailTimelineEntry = {
  kind: EmailTimelineKind;
  at: IsoTimestamp;
  detail: string;
};

export type MimePart = {
  part_id: string;
  content_type: string;
  transfer_encoding: string | null;
  charset: string | null;
  size_bytes: number;
  filename: string | null;
  content_id: string | null;
  children: MimePart[];
};

export type EmailListFilters = PageRequest & {
  query?: string;
  from?: string;
  to?: string;
  tag?: string;
  is_unread?: boolean;
  has_attachment?: boolean;
  source?: EmailSource;
  direction?: EmailDirection;
};

export type EmailUpdate = {
  /**
   * Marks the email as read (true) or unread (false).
   * @example true
   */
  is_read?: boolean;
  /**
   * Replaces the email's tags; an empty list removes them all.
   * @example ["signup", "qa"]
   */
  tags?: string[];
};

export type SimulatedEmailOutcome = {
  /**
   * The delivery event to simulate; it is added to the timeline and fires its webhook.
   * @example "bounced"
   */
  event: EmailDeliveryStatus;
  /**
   * For `bounced` only: a hard bounce (the address does not exist) or a soft one (try again later).
   * @example "hard"
   */
  bounce_type?: "hard" | "soft";
};

/** One file in `attachments` of POST /api/v1/send. */
export type NativeSendAttachment = {
  /**
   * The file name the recipient sees.
   * @example "invoice-1042.pdf"
   */
  filename: string;
  /**
   * The file bytes, base64 encoded.
   * @example "JVBERi0xLjQKJcfsj6IK"
   */
  content: string;
  /**
   * Guessed from the file extension when missing.
   * @example "application/pdf"
   */
  content_type?: string;
  /**
   * Makes the attachment inline, shown in the HTML with `cid:<content_id>`.
   * @example "logo"
   */
  content_id?: string;
};

/** Body of POST /api/v1/send (native HTTP send API). */
export type NativeSendRequest = {
  /**
   * The sender, as an address or `Name <address>`.
   * @example "Shop <no-reply@shop.test>"
   */
  from: string;
  /**
   * The recipients.
   * @example ["user@example.test"]
   */
  to: string[];
  /**
   * Copy recipients.
   * @example ["manager@example.test"]
   */
  cc?: string[];
  /**
   * Hidden copy recipients; stored with the email but not in its headers.
   * @example ["audit@example.test"]
   */
  bcc?: string[];
  /**
   * The subject line.
   * @example "Your order #1042 has shipped"
   */
  subject: string;
  /**
   * The plain-text body. Send `text`, `html` or both.
   * @example "Hi Sam, your order is on its way."
   */
  text?: string;
  /**
   * The HTML body. Send `text`, `html` or both.
   * @example "<p>Hi Sam, your order is <b>on its way</b>.</p>"
   */
  html?: string;
  /**
   * Extra headers, by name.
   * @example {"X-Order-Id": "1042"}
   */
  headers?: Record<string, string>;
  /**
   * Tags to file the email under in Mail.
   * @example ["orders"]
   */
  tags?: string[];
  /**
   * Files to attach.
   */
  attachments?: NativeSendAttachment[];
};

/** Body of POST /api/v1/emails/{emailId}/reply (simulate the recipient replying). */
export type EmailReplyRequest = {
  /**
   * The reply text, above the quoted original.
   * @example "Thanks, that fixed it!"
   */
  body: string;
  /**
   * Who replies; defaults to the original recipient.
   * @example "user@example.test"
   */
  from?: string;
  /**
   * Defaults to `Re: <original subject>`.
   * @example "Re: Ticket #318 updated"
   */
  subject?: string;
  /**
   * Also sends to the other original recipients, in Cc.
   * @example false
   */
  reply_all?: boolean;
  /**
   * Quotes the original below an "On ... wrote:" line (default true).
   * @example true
   */
  include_original?: boolean;
};

/** Body of POST /api/v1/emails/{emailId}/forward (simulate the recipient forwarding). */
export type EmailForwardRequest = {
  /**
   * Where the email is forwarded, e.g. your app's inbound address.
   * @example "support@inbound.app.test"
   */
  to: string;
  /**
   * A note above the forwarded message.
   * @example "Can you look at this one?"
   */
  body?: string;
  /**
   * Who forwards; defaults to the original recipient.
   * @example "user@example.test"
   */
  from?: string;
  /**
   * Defaults to `Fwd: <original subject>`.
   * @example "Fwd: Your invoice"
   */
  subject?: string;
  /**
   * Adds the original below a "Forwarded message" block (default true).
   * @example true
   */
  include_original?: boolean;
  /**
   * Forwards the original attachments too (default true).
   * @example true
   */
  include_attachments?: boolean;
};

/** Answer of `POST /send`: the stored email's id. */
export type NativeSendResult = {
  id: Ulid;
};

/** Body of `POST /emails/{emailId}/release`; empty sends to the original recipients. */
export type EmailReleaseRequest = {
  /**
   * Who receives it on the real SMTP server; empty sends to the original recipients. Every address must match the release allowlist.
   * @example ["qa@yourcompany.com"]
   */
  to?: string[];
};

/** Body of POST /api/v1/emails/inbound: an incoming email from fields, or raw MIME in `raw`. */
export type EmailInboundRequest = {
  /**
   * The sender, as an address or `Name <address>`.
   * @example "Sam <sam@customer.test>"
   */
  from?: string;
  /**
   * The recipients, usually your app's inbound address.
   * @example ["support@inbound.app.test"]
   */
  to?: string[];
  /**
   * The subject line.
   * @example "Order arrived damaged"
   */
  subject?: string;
  /**
   * The plain-text body.
   * @example "The box was crushed, can I get a replacement?"
   */
  text?: string;
  /**
   * The HTML body.
   * @example "<p>The box was crushed, can I get a replacement?</p>"
   */
  html?: string;
  /**
   * A whole message (RFC 5322); when set, the other fields are ignored.
   * @example "From: sam@customer.test\r\nTo: support@inbound.app.test\r\nSubject: Hi\r\n\r\nHello"
   */
  raw?: string;
};
