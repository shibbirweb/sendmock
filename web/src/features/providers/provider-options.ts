import type {
  MessageProviderArea,
  ProviderErrorKind,
  ProviderMessagePart,
  ProviderOperation,
  ProviderOperationKind,
  ProviderValidationRule,
} from "@/lib/api/types";

/** The requests SendMock can run, by area (docs/plan/22, Operation kinds). */
export const operationKindsByArea: Record<
  MessageProviderArea,
  { kind: ProviderOperationKind; label: string }[]
> = {
  email: [
    { kind: "send", label: "Send" },
    { kind: "send_batch", label: "Send batch" },
    { kind: "send_with_template", label: "Send with template" },
    { kind: "fetch", label: "Fetch one" },
  ],
  sms: [
    { kind: "send", label: "Send" },
    { kind: "fetch", label: "Fetch one" },
    { kind: "list", label: "List" },
    { kind: "cancel", label: "Cancel" },
    { kind: "start_verification", label: "Start verification" },
    { kind: "check_verification", label: "Check verification" },
  ],
};

/** The message parts a mapping or a rule can name, by area. */
export const messagePartsByArea: Record<
  MessageProviderArea,
  ProviderMessagePart[]
> = {
  email: [
    "from",
    "to",
    "cc",
    "bcc",
    "reply_to",
    "subject",
    "text",
    "html",
    "attachments",
    "headers",
    "tags",
    "template_id",
    "template_data",
  ],
  sms: [
    "from",
    "to",
    "body",
    "media_urls",
    "messaging_service",
    "status_callback_url",
  ],
};

/** SendMock's statuses a provider names, by area. */
export const statusesByArea: Record<MessageProviderArea, string[]> = {
  email: ["delivered", "bounced", "complained", "opened"],
  sms: ["queued", "sent", "delivered", "undelivered", "failed", "read"],
};

/** The delivery outcomes an SMS provider gives its own error code (the magic test numbers). */
export const smsOutcomes = [
  "invalid_number",
  "cannot_route",
  "no_international_permission",
  "blocked",
  "cannot_receive_sms",
  "invalid_from",
  "not_sms_capable",
  "queue_full",
  "unreachable_handset",
  "landline",
  "carrier_filtered",
  "unknown_error",
];

export const httpMethods: ProviderOperation["method"][] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

export const requestFormats: {
  format: ProviderOperation["request_format"];
  label: string;
}[] = [
  { format: "json", label: "JSON" },
  { format: "form", label: "Form" },
  { format: "multipart", label: "Multipart" },
  { format: "query", label: "Query only" },
];

export const validationChecks: {
  check: ProviderValidationRule["check"];
  label: string;
}[] = [
  { check: "required", label: "Required" },
  { check: "email_address", label: "Email address" },
  { check: "e164_number", label: "E.164 number" },
  { check: "max_length", label: "Max length" },
];

export const errorKinds: { kind: ProviderErrorKind; label: string }[] = [
  { kind: "missing_field", label: "Missing field" },
  { kind: "invalid_value", label: "Invalid value" },
  { kind: "unauthorized", label: "Unauthorized" },
  { kind: "not_found", label: "Not found" },
  { kind: "rate_limited", label: "Rate limited" },
];
