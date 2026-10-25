/**
 * Names shown on the landing page. The marquee lists them and the number
 * ticker counts them, so the two always agree.
 */

/** Languages the cross-language CI matrix sends from (examples/). */
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

/** Providers whose real API SendMock answers, by product area. */
export const emulatedProviderNames = {
  email: ["SendGrid", "Mailgun", "Postmark", "Resend", "Amazon SES", "Brevo"],
  sms: ["Twilio", "Twilio Verify", "Vonage", "Plivo", "Telnyx"],
  payments: ["Stripe", "PayPal", "SSLCommerz", "bKash"],
};

/** Chat tools the webhook templates post to. */
export const webhookTargetNames = ["Slack", "Discord", "Microsoft Teams"];

export const allEmulatedProviderNames = Object.values(
  emulatedProviderNames,
).flat();
