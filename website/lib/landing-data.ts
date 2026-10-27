/**
 * Names shown on the landing page. The marquee lists them and the number
 * ticker counts them, so the two always agree.
 */

/** Languages with a connection guide (docs/wiki/connect/), later the CI matrix (examples/). */
export const testedLanguageNames = [
  "PHP",
  "Node.js",
  "Python",
  "Go",
  "Java",
  "Rust",
  "Ruby",
  ".NET",
];

/** Frameworks that work through plain SMTP or the provider APIs. */
export const frameworkNames = [
  "Laravel",
  "Django",
  "Spring",
  "Rails",
  "Express",
];

/**
 * The built-in providers whose real API SendMock answers, by product area.
 * Users can change, remove or add providers; the landing page counts the
 * built-ins. docs/wiki/providers.md lists the same names (landing-data.test.ts).
 */
export const emulatedProviderNames = {
  email: ["SendGrid", "Mailgun", "Postmark", "Resend", "Amazon SES", "Brevo"],
  sms: ["Twilio", "Twilio Verify", "Vonage", "Plivo", "MessageBird"],
  payments: ["Stripe", "PayPal", "SSLCommerz", "bKash"],
};

/** Chat tools the webhook templates post to. */
export const webhookTargetNames = ["Slack", "Discord", "Microsoft Teams"];

export const allEmulatedProviderNames = Object.values(
  emulatedProviderNames,
).flat();
