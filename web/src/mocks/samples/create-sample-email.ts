import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import { buildDeliveredSmtpSession } from "@/mocks/fixtures/smtp-session-fixtures";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/**
 * A sample email as if an app sent it over SMTP: the email and the SMTP
 * session that delivered it, linked both ways (UI-04.2).
 */
export function createSampleEmail(): string {
  const emailFixture = buildEmailFixture({
    minutesAgo: 0,
    from: { name: "Acme App", address: "no-reply@acme.test" },
    to: [{ name: "", address: "you@example.com" }],
    subject: "Your verification code",
    textBody: "Hi! Your verification code is 739104. It expires in 10 minutes.",
    htmlBody:
      "<h2>Verify your account</h2><p>Your verification code is <strong>739104</strong>. It expires in 10 minutes.</p>",
    source: "smtp",
  });
  const sampleEmail = emailFixture.email;

  mockDatabase.emails.unshift(sampleEmail);
  mockDatabase.emailTimelines.set(sampleEmail.id, emailFixture.timeline);
  mockDatabase.smtpSessions.unshift(buildDeliveredSmtpSession(sampleEmail, 0));
  publishMockEvent("email.received", {
    id: sampleEmail.id,
    subject: sampleEmail.subject,
    from: sampleEmail.from,
  });

  return sampleEmail.id;
}
