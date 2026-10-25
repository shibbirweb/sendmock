import type {
  ApiRequestLogFilters,
  DeliveryListFilters,
  EmailListFilters,
  RulePreviewRequest,
  TemplateRenderRequest,
  VariablePreviewRequest,
  SmsListFilters,
  SmtpSessionListFilters,
  VerificationListFilters,
} from "@/lib/api/types";

/**
 * Query keys for every resource. Realtime events invalidate by the top-level
 * key (e.g. ["emails"]), which refreshes every list and detail below it.
 */
export const queryKeys = {
  emails: {
    all: ["emails"] as const,
    list: (emailFilters: EmailListFilters) =>
      ["emails", "list", emailFilters] as const,
    detail: (emailId: string) => ["emails", "detail", emailId] as const,
    timeline: (emailId: string) => ["emails", "timeline", emailId] as const,
    infiniteList: (emailFilters: EmailListFilters) =>
      ["emails", "infinite-list", emailFilters] as const,
    raw: (emailId: string) => ["emails", "raw", emailId] as const,
    mime: (emailId: string) => ["emails", "mime", emailId] as const,
    htmlCheck: (emailId: string) => ["emails", "html-check", emailId] as const,
    spamCheck: (emailId: string) => ["emails", "spam-check", emailId] as const,
    listUnsubscribe: (emailId: string) =>
      ["emails", "list-unsubscribe", emailId] as const,
  },
  sms: {
    all: ["sms"] as const,
    list: (smsFilters: SmsListFilters) => ["sms", "list", smsFilters] as const,
    threads: ["sms", "threads"] as const,
    detail: (smsId: string) => ["sms", "detail", smsId] as const,
  },
  verify: {
    all: ["verify"] as const,
    verifications: (verificationFilters: VerificationListFilters) =>
      ["verify", "verifications", verificationFilters] as const,
    detail: (verificationSid: string) =>
      ["verify", "detail", verificationSid] as const,
    services: ["verify", "services"] as const,
  },
  numbers: {
    all: ["numbers"] as const,
    virtualNumbers: ["numbers", "virtual-numbers"] as const,
    messagingServices: ["numbers", "messaging-services"] as const,
  },
  webhooks: {
    all: ["webhooks"] as const,
    endpoints: ["webhooks", "endpoints"] as const,
    rules: ["webhooks", "rules"] as const,
    rulePreview: (previewRequest: RulePreviewRequest) =>
      ["webhooks", "rule-preview", previewRequest] as const,
    deliveries: (deliveryFilters: DeliveryListFilters) =>
      ["webhooks", "deliveries", deliveryFilters] as const,
    delivery: (deliveryId: string) =>
      ["webhooks", "delivery", deliveryId] as const,
    templates: ["webhooks", "templates"] as const,
    template: (templateId: string) =>
      ["webhooks", "template", templateId] as const,
    templateReference: (eventsText: string) =>
      ["webhooks", "template-reference", eventsText] as const,
    templateRevisions: (templateId: string) =>
      ["webhooks", "template-revisions", templateId] as const,
    templatePreview: (
      templateId: string,
      renderRequest: TemplateRenderRequest,
    ) => ["webhooks", "template-preview", templateId, renderRequest] as const,
    variables: ["webhooks", "variables"] as const,
    variablePreview: (previewRequest: VariablePreviewRequest) =>
      ["webhooks", "variable-preview", previewRequest] as const,
    saved: ["webhooks", "saved"] as const,
  },
  httpCatcher: {
    all: ["http-catcher"] as const,
    bins: ["http-catcher", "bins"] as const,
    requests: (binId: string | null) =>
      ["http-catcher", "requests", binId] as const,
  },
  logs: {
    all: ["logs"] as const,
    smtpSessions: (sessionFilters: SmtpSessionListFilters) =>
      ["logs", "smtp", sessionFilters] as const,
    smtpSession: (sessionId: string) =>
      ["logs", "smtp-session", sessionId] as const,
    apiRequests: (requestFilters: ApiRequestLogFilters) =>
      ["logs", "http", requestFilters] as const,
    apiRequest: (requestId: string) =>
      ["logs", "http-request", requestId] as const,
  },
  outcomeRules: {
    all: ["outcome-rules"] as const,
    sms: ["outcome-rules", "sms"] as const,
    email: ["outcome-rules", "email"] as const,
  },
  system: {
    stats: ["system", "stats"] as const,
    info: ["system", "info"] as const,
    settings: ["system", "settings"] as const,
    seedStatus: ["system", "seed-status"] as const,
  },
};
