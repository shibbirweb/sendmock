import type {
  EmailDetail,
  LinksLookup,
  OtpLookup,
  SmsMessageDetail,
  VerificationDetail,
} from "@/lib/api/types";

type ExtractedSources = {
  emails: EmailDetail[];
  smsMessages: SmsMessageDetail[];
  verifications: VerificationDetail[];
};

function isEmailTo(email: EmailDetail, recipient: string): boolean {
  return email.to.some(
    (emailAddress) =>
      emailAddress.address.toLowerCase() === recipient.toLowerCase(),
  );
}

function stripChannel(phoneNumber: string): string {
  return phoneNumber.replace(/^whatsapp:/i, "");
}

/** The newest code sent to an address or number, from mail, SMS or Verify (`GET /otp`). */
export function findLatestOtp(
  sources: ExtractedSources,
  recipient: string,
  channel: string | null,
): OtpLookup | undefined {
  const candidates: OtpLookup[] = [];
  if (channel === null || channel === "email") {
    for (const email of sources.emails) {
      const code = email.extracted.otp[0];
      if (code !== undefined && isEmailTo(email, recipient)) {
        candidates.push({
          to: recipient,
          channel: "email",
          code,
          source_id: email.id,
          received_at: email.received_at,
        });
      }
    }
  }
  if (channel === null || channel === "sms") {
    for (const smsMessage of sources.smsMessages) {
      const code = smsMessage.extracted.otp[0];
      if (
        code !== undefined &&
        stripChannel(smsMessage.to_number) === stripChannel(recipient)
      ) {
        candidates.push({
          to: recipient,
          channel: "sms",
          code,
          source_id: smsMessage.id,
          received_at: smsMessage.created_at,
        });
      }
    }
  }
  if (channel === null || channel === "verify") {
    for (const verification of sources.verifications) {
      if (stripChannel(verification.to) === stripChannel(recipient)) {
        candidates.push({
          to: recipient,
          channel: "verify",
          code: verification.code,
          source_id: verification.sid,
          received_at: verification.created_at,
        });
      }
    }
  }

  return candidates.toSorted((firstLookup, secondLookup) =>
    secondLookup.received_at.localeCompare(firstLookup.received_at),
  )[0];
}

/** The links of the newest email to an address that has any (`GET /links`). */
export function findLatestLinks(
  emails: EmailDetail[],
  recipient: string,
): LinksLookup | undefined {
  const latestEmail = emails
    .filter(
      (email) =>
        email.extracted.links.length > 0 && isEmailTo(email, recipient),
    )
    .toSorted((firstEmail, secondEmail) =>
      secondEmail.received_at.localeCompare(firstEmail.received_at),
    )[0];

  return latestEmail === undefined
    ? undefined
    : {
        to: recipient,
        email_id: latestEmail.id,
        links: latestEmail.extracted.links,
        received_at: latestEmail.received_at,
      };
}
