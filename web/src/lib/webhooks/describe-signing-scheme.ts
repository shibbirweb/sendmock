/** Signing schemes by template id prefix; native and the rest use Standard Webhooks. */
const providerSigningSchemes: [
  templatePrefix: string,
  signingScheme: string,
][] = [
  ["twilio.", "Twilio X-Twilio-Signature (HMAC-SHA1 with twilio_auth_token)"],
  ["mailgun.", "Mailgun timestamp, token and signature (mailgun_signing_key)"],
  ["sendgrid.events", "SendGrid signed Event Webhook"],
  ["resend.", "Resend Svix headers (resend_signing_secret)"],
  ["slack.", "None: Slack incoming webhooks are not signed"],
  ["discord.", "None: Discord webhooks are not signed"],
];

/** Which signature a receiver of this template should verify. */
export function describeSigningScheme(templateId: string): string {
  const providerScheme = providerSigningSchemes.find(([templatePrefix]) =>
    templateId.startsWith(templatePrefix),
  );

  return (
    providerScheme?.[1] ??
    "Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature)"
  );
}
