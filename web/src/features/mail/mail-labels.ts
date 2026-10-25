import type { EmailDeliveryStatus, EmailSource } from "@/lib/api/types";

/** Short names for how an email reached SendMock. */
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

export const deliveryStatusLabels: Record<EmailDeliveryStatus, string> = {
  delivered: "Delivered",
  deferred: "Deferred",
  bounced: "Bounced",
  complained: "Complaint",
  unsubscribed: "Unsubscribed",
};
