import type { ApiStatusClass, SmtpSessionResult } from "@/lib/api/types";

export const smtpResultLabels: Record<SmtpSessionResult, string> = {
  delivered: "Delivered",
  rejected: "Rejected",
  aborted: "Aborted",
};

export type SmtpResultFilter = "all" | "delivered" | "failed";

export const smtpResultFilters: {
  resultFilter: SmtpResultFilter;
  label: string;
  results: SmtpSessionResult[] | null;
}[] = [
  { resultFilter: "all", label: "All", results: null },
  { resultFilter: "delivered", label: "Delivered", results: ["delivered"] },
  { resultFilter: "failed", label: "Failed", results: ["rejected", "aborted"] },
];

/** Names for the APIs SendMock emulates; unknown ones show as sent. */
const apiLabels: Record<string, string> = {
  native: "Native",
  twilio: "Twilio",
  vonage: "Vonage",
  plivo: "Plivo",
  messagebird: "MessageBird",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  postmark: "Postmark",
  resend: "Resend",
  ses: "SES",
  brevo: "Brevo",
};

export function readApiLabel(apiName: string): string {
  return apiLabels[apiName] ?? apiName;
}

/** Options of the API picker, in display order. */
export const apiFilterOptions = Object.keys(apiLabels);

export const statusClassFilters: {
  statusClass: ApiStatusClass | null;
  label: string;
}[] = [
  { statusClass: null, label: "All" },
  { statusClass: "2xx", label: "2xx" },
  { statusClass: "4xx", label: "4xx" },
  { statusClass: "5xx", label: "5xx" },
];

export function isRejectedStatus(responseStatus: number): boolean {
  return responseStatus >= 400;
}
