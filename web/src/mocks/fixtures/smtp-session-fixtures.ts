import type { EmailDetail, SmtpSession } from "@/lib/api/types";
import {
  createMockUlid,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";

const greeting = "S: 220 sendmock ESMTP ready";

function buildEhloLines(heloName: string): string[] {
  return [
    `C: EHLO ${heloName}`,
    `S: 250-sendmock Hello ${heloName}`,
    "S: 250-PIPELINING",
    "S: 250-SIZE 26214400",
    "S: 250-STARTTLS",
    "S: 250 AUTH PLAIN LOGIN CRAM-MD5",
  ];
}

function buildDeliveredTranscript(email: EmailDetail, heloName: string) {
  return [
    greeting,
    ...buildEhloLines(heloName),
    "C: STARTTLS",
    "S: 220 2.0.0 Ready to start TLS",
    ...buildEhloLines(heloName),
    "C: AUTH PLAIN ••••••••",
    "S: 235 2.7.0 Authentication successful",
    `C: MAIL FROM:<${email.envelope_from}>`,
    "S: 250 2.1.0 OK",
    ...email.envelope_to.flatMap((recipientAddress) => [
      `C: RCPT TO:<${recipientAddress}>`,
      "S: 250 2.1.5 OK",
    ]),
    "C: DATA",
    "S: 354 End data with <CR><LF>.<CR><LF>",
    `C: [message ${email.size_bytes.toLocaleString("en")} bytes, stored as email]`,
    "S: 250 2.0.0 Queued",
    "C: QUIT",
    "S: 221 2.0.0 Bye",
  ].join("\n");
}

const deliveringClients = [
  {
    heloName: "laravel.local",
    remoteAddress: "127.0.0.1",
    authUser: "laravel",
  },
  { heloName: "rails-app", remoteAddress: "172.18.0.7", authUser: "rails" },
  { heloName: "django.local", remoteAddress: "127.0.0.1", authUser: "django" },
];

/** The session that delivered an SMTP email, linked both ways (EM-09.3). */
function buildDeliveredSession(
  email: EmailDetail,
  emailIndex: number,
): SmtpSession {
  const deliveringClient =
    deliveringClients[emailIndex % deliveringClients.length] ??
    deliveringClients[0];
  const endedAtMs = Date.parse(email.received_at);
  const startedAtMs = endedAtMs - 120 - (emailIndex % 5) * 37;
  const sessionId = createMockUlid(startedAtMs);
  email.smtp_session_id = sessionId;

  return {
    id: sessionId,
    remote_address: `${deliveringClient?.remoteAddress ?? "127.0.0.1"}:${50000 + emailIndex}`,
    helo_name: deliveringClient?.heloName ?? "localhost",
    tls_version: "TLS 1.3",
    auth_mechanism: "PLAIN",
    auth_user: deliveringClient?.authUser ?? null,
    result: "delivered",
    failure_reason: null,
    email_ids: [email.id],
    transcript: buildDeliveredTranscript(
      email,
      deliveringClient?.heloName ?? "localhost",
    ),
    started_at: new Date(startedAtMs).toISOString(),
    ended_at: new Date(endedAtMs).toISOString(),
  };
}

const failedAuthTranscript = [
  greeting,
  "C: EHLO worker-3",
  "S: 250-sendmock Hello worker-3",
  "S: 250 AUTH PLAIN LOGIN",
  "C: AUTH LOGIN",
  "S: 334 VXNlcm5hbWU6",
  "C: ••••••••",
  "S: 334 UGFzc3dvcmQ6",
  "C: ••••••••",
  "S: 535 5.7.8 Authentication credentials invalid",
  "C: QUIT",
  "S: 221 2.0.0 Bye",
].join("\n");

const rejectedRecipientTranscript = [
  greeting,
  ...buildEhloLines("rails-app"),
  "C: MAIL FROM:<orders@shop.test>",
  "S: 250 2.1.0 OK",
  "C: RCPT TO:<bounce@reject.test>",
  "S: 550 5.1.1 No such user (chaos rule: reject *@reject.test)",
  "C: QUIT",
  "S: 221 2.0.0 Bye",
].join("\n");

const oversizedTranscript = [
  greeting,
  ...buildEhloLines("django.local"),
  "C: MAIL FROM:<reports@acme.test> SIZE=31457280",
  "S: 552 5.3.4 Message size exceeds the 25 MB limit",
  "C: QUIT",
  "S: 221 2.0.0 Bye",
].join("\n");

const tlsAbortedTranscript = [
  greeting,
  ...buildEhloLines("legacy-cron"),
  "C: STARTTLS",
  "S: 220 2.0.0 Ready to start TLS",
  "[connection closed by client during the TLS handshake]",
].join("\n");

type SmtpSessionSpec = Omit<
  SmtpSession,
  "id" | "email_ids" | "started_at" | "ended_at"
> & { minutesAgo: number; durationMs: number };

const smtpSessionSpecs: SmtpSessionSpec[] = [
  {
    minutesAgo: 9,
    durationMs: 42,
    remote_address: "172.18.0.7:51988",
    helo_name: "rails-app",
    tls_version: null,
    auth_mechanism: null,
    auth_user: null,
    result: "rejected",
    failure_reason: "550 5.1.1 No such user",
    transcript: rejectedRecipientTranscript,
  },
  {
    minutesAgo: 17,
    durationMs: 61,
    remote_address: "172.18.0.5:40112",
    helo_name: "worker-3",
    tls_version: null,
    auth_mechanism: "LOGIN",
    auth_user: "worker",
    result: "rejected",
    failure_reason: "535 5.7.8 Authentication credentials invalid",
    transcript: failedAuthTranscript,
  },
  {
    minutesAgo: 26,
    durationMs: 23,
    remote_address: "127.0.0.1:50211",
    helo_name: "django.local",
    tls_version: null,
    auth_mechanism: null,
    auth_user: null,
    result: "rejected",
    failure_reason: "552 5.3.4 Message size exceeds the 25 MB limit",
    transcript: oversizedTranscript,
  },
  {
    minutesAgo: 44,
    durationMs: 5004,
    remote_address: "10.0.0.12:33870",
    helo_name: "legacy-cron",
    tls_version: null,
    auth_mechanism: null,
    auth_user: null,
    result: "aborted",
    failure_reason: "Connection closed during the TLS handshake",
    transcript: tlsAbortedTranscript,
  },
];

/**
 * One delivered session per SMTP email, plus the failed sessions that stored
 * nothing (rejected recipient, bad AUTH, size limit, dropped TLS), newest
 * first.
 */
export function buildSmtpSessionFixtures(emails: EmailDetail[]): SmtpSession[] {
  const deliveredSessions = emails
    .filter((email) => email.source === "smtp")
    .map(buildDeliveredSession);
  const failedSessions = smtpSessionSpecs.map(
    ({ minutesAgo: sessionMinutesAgo, durationMs, ...sessionFields }) => {
      const startedAtMs = minutesAgoInMs(sessionMinutesAgo);

      return {
        ...sessionFields,
        id: createMockUlid(startedAtMs),
        email_ids: [],
        started_at: new Date(startedAtMs).toISOString(),
        ended_at: new Date(startedAtMs + durationMs).toISOString(),
      };
    },
  );

  return [...deliveredSessions, ...failedSessions].sort(
    (laterSession, earlierSession) =>
      Date.parse(earlierSession.started_at) -
      Date.parse(laterSession.started_at),
  );
}
