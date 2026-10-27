import type {
  EmailDeliveryStatus,
  EmailSource,
  EmailTransportSource,
} from "@/lib/api/types";

/** Short names for how an email reached SendMock; a custom provider shows its key. */
export const emailSourceLabels: Record<EmailSource, string> = {
  smtp: "SMTP",
  sendmail: "sendmail",
  native_api: "API",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  postmark: "Postmark",
  resend: "Resend",
  ses: "SES",
  brevo: "Brevo",
  verify: "Verify",
  simulated: "Simulated",
};

const emailTransportSources: EmailTransportSource[] = [
  "smtp",
  "sendmail",
  "native_api",
  "verify",
  "simulated",
];

/** A source that is not a provider's API: SMTP, sendmail, the native API, Verify or a simulation. */
export function isEmailTransportSource(emailSource: EmailSource): boolean {
  return (emailTransportSources as string[]).includes(emailSource);
}

export function labelEmailSource(emailSource: EmailSource): string {
  return emailSourceLabels[emailSource] ?? emailSource;
}

export const deliveryStatusLabels: Record<EmailDeliveryStatus, string> = {
  delivered: "Delivered",
  deferred: "Deferred",
  bounced: "Bounced",
  complained: "Complaint",
  unsubscribed: "Unsubscribed",
};
