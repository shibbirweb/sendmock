/** A local stand-in for a provider's email template (EM-26.2). */
export type EmailTemplate = {
  /**
   * The provider's template id or name: SendGrid's `d-...`, Postmark's number or alias, Mailgun's template name.
   * @example "welcome-email"
   */
  id: string;
  /**
   * The subject, used when the send gives none; can use the template data.
   * @example "Welcome, {{ first_name }}"
   */
  subject: string;
  /**
   * The plain-text body; at least one of `text` and `html`.
   * @example "Hi {{ first_name }}, thanks for joining."
   */
  text: string | null;
  /** The HTML body. */
  html: string | null;
};

/** What an update can change; the id is fixed. */
export type EmailTemplateChanges = {
  subject: string;
  text: string | null;
  html: string | null;
};
