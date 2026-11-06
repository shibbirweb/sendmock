/**
 * Test cases 2 to 8 of docs/plan/09-distribution.md (Binary tests on every platform), run
 * against an installed `sendmock`: the binary unpacked from an archive, or the command a
 * package channel put on the PATH. Written once, so every platform and channel runs the same
 * list (DS-01.4, DS-03.6).
 */

import {
  check,
  checkRunningBinary,
  type RunningSendmock,
  startSendmock,
  stopSendmock,
} from "../binary-smoke-test";
import { sendTestEmail } from "./smtp-test-client";

const freePortArguments = [
  "--http-addr",
  "127.0.0.1:0",
  "--smtp-addr",
  "127.0.0.1:0",
];
const twilioMessagesPath =
  "/providers/twilio/2010-04-01/Accounts/AC11111111111111111111111111111111/Messages.json";

function checkVersion(
  binaryPath: string,
  expectedVersion: string,
  expectedChannel: string,
) {
  const versionResult = Bun.spawnSync([binaryPath, "version", "--json"]);
  const reportedVersion = JSON.parse(versionResult.stdout.toString()) as {
    version: string;
    channel: string;
  };
  check(
    reportedVersion.version === expectedVersion &&
      reportedVersion.channel === expectedChannel,
    `2. sendmock version reports ${expectedVersion} (${expectedChannel})`,
  );
}

function checkCleanStop(exitCode: number) {
  if (process.platform !== "win32") {
    check(exitCode === 0, "8. SIGTERM stops it with exit code 0");
  }
}

/** Cases 3, 4 and 5 on the default addresses, with nothing installed beside the binary. */
async function checkDefaultListeners(binaryPath: string) {
  const runningSendmock = await startSendmock(binaryPath, ["--db", "memory"]);
  try {
    check(
      runningSendmock.httpAddress === "127.0.0.1:8025" &&
        runningSendmock.smtpAddress === "127.0.0.1:1025",
      "3. it starts and listens on 127.0.0.1:8025 and 127.0.0.1:1025 only",
    );
    const healthResult = Bun.spawnSync([
      binaryPath,
      "health",
      "--server",
      `http://${runningSendmock.httpAddress}`,
    ]);
    check(
      healthResult.exitCode === 0,
      "4. sendmock health exits 0 once it is ready",
    );
    await checkRunningBinary(`http://${runningSendmock.httpAddress}`);
  } finally {
    checkCleanStop(await stopSendmock(runningSendmock));
  }
}

async function readItems(
  baseUrl: string,
  path: string,
): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${baseUrl}${path}`);
  const answer = (await response.json()) as {
    items?: Record<string, unknown>[];
  };
  return answer.items ?? [];
}

async function sendAndReadBack(
  runningSendmock: RunningSendmock,
  marker: string,
) {
  const baseUrl = `http://${runningSendmock.httpAddress}`;
  await sendTestEmail(runningSendmock.smtpAddress, {
    from: "app@shop.test",
    to: "release-test@example.test",
    subject: `Release test ${marker}`,
    text: "Sent by the release test.",
  });
  const smsResponse = await fetch(`${baseUrl}${twilioMessagesPath}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      To: "+15551234567",
      From: "+15550001111",
      Body: `Release test ${marker}`,
    }).toString(),
  });
  const emails = await readItems(
    baseUrl,
    `/api/v1/emails?query=${encodeURIComponent(marker)}`,
  );
  const smsMessages = await readItems(
    baseUrl,
    `/api/v1/sms?query=${encodeURIComponent(marker)}`,
  );
  check(
    emails.some((email) => email.subject === `Release test ${marker}`),
    "6. an email sent over SMTP is read back through the API",
  );
  check(
    smsResponse.ok &&
      smsMessages.some((sms) => String(sms.body).includes(marker)),
    "6. an SMS sent through the Twilio API is read back through the API",
  );
}

/** Cases 6, 7 and 8 in the operating system's default data folder. */
async function checkDataAcrossRestart(binaryPath: string) {
  const marker = `${Date.now()}`;
  const firstRun = await startSendmock(binaryPath, freePortArguments);
  try {
    await sendAndReadBack(firstRun, marker);
  } finally {
    checkCleanStop(await stopSendmock(firstRun));
  }
  const secondRun = await startSendmock(binaryPath, freePortArguments);
  try {
    const emails = await readItems(
      `http://${secondRun.httpAddress}`,
      `/api/v1/emails?query=${encodeURIComponent(marker)}`,
    );
    check(
      emails.length === 1,
      "7. after a restart the captured email is still there (the default data folder)",
    );
  } finally {
    checkCleanStop(await stopSendmock(secondRun));
  }
}

export async function runInstalledBinaryChecks(
  binaryPath: string,
  expectedVersion: string,
  expectedChannel: string,
) {
  checkVersion(binaryPath, expectedVersion, expectedChannel);
  await checkDefaultListeners(binaryPath);
  await checkDataAcrossRestart(binaryPath);
}
