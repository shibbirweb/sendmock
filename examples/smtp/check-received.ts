#!/usr/bin/env bun
/**
 * Checks that SendMock stored the email a client in this folder sent (EM-01.5): it is
 * listed with its subject, sender and recipient, and the code in its body was extracted.
 *
 *     bun examples/smtp/check-received.ts "<subject>" [http://127.0.0.1:8025]
 */

const [subject, serverUrl = "http://127.0.0.1:8025"] = process.argv.slice(2);
const expectedCode = "482913";
const expectedRecipient = "user@example.test";

type EmailSummary = { id: string; subject: string; from: { address: string }; to: { address: string }[] };

async function findEmail(): Promise<EmailSummary | null> {
  const listUrl = `${serverUrl}/api/v1/emails?limit=200`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const emailPage = (await (await fetch(listUrl)).json()) as { items: EmailSummary[] };
    const email = emailPage.items.find((listedEmail) => listedEmail.subject === subject);
    if (email) {
      return email;
    }
    await Bun.sleep(250);
  }
  return null;
}

if (!subject) {
  console.error('Usage: bun examples/smtp/check-received.ts "<subject>" [server URL]');
  process.exit(2);
}
const email = await findEmail();
if (email === null) {
  console.error(`Failed: no email with the subject ${subject}`);
  process.exit(1);
}
const emailDetail = (await (await fetch(`${serverUrl}/api/v1/emails/${email.id}`)).json()) as {
  extracted: { otp?: string[] };
};
const extractedCodes = emailDetail.extracted.otp ?? [];
const problems = [
  email.to.some((recipient) => recipient.address === expectedRecipient) ? null : `the recipient is not ${expectedRecipient}`,
  email.from.address.endsWith(".test") ? null : `the sender ${email.from.address} is not the example's`,
  extractedCodes.includes(expectedCode) ? null : `the code ${expectedCode} was not extracted (${JSON.stringify(emailDetail.extracted)})`,
].filter((problem) => problem !== null);
if (problems.length > 0) {
  console.error(`Failed: ${problems.join("; ")}`);
  process.exit(1);
}
console.log(`ok   ${subject}: stored from ${email.from.address} with code ${expectedCode}`);
