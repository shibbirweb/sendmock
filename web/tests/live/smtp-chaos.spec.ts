import { createConnection } from "node:net";

import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";
import { readSmtpReplies } from "./live-smtp";

/** Sends one message the way an app's mailer does and answers every reply code it got. */
async function sendOverSmtp(
  smtpAddress: string,
  subject: string,
): Promise<number[]> {
  const [smtpHost, smtpPort] = smtpAddress.split(":");
  const smtpSocket = createConnection({
    host: smtpHost,
    port: Number(smtpPort),
  });
  const readNextReply = readSmtpReplies(smtpSocket);
  const replyCodes = [await readNextReply()];
  const smtpCommands = [
    "EHLO app.test",
    "MAIL FROM:<app@shop.test>",
    "RCPT TO:<sam@example.test>",
    "DATA",
    `From: app@shop.test\r\nTo: sam@example.test\r\nSubject: ${subject}\r\n\r\nHello.\r\n.`,
  ];
  for (const smtpCommand of smtpCommands) {
    const nextReply = readNextReply();
    smtpSocket.write(`${smtpCommand}\r\n`);
    const replyCode = await nextReply;
    replyCodes.push(replyCode);
    if (replyCode >= 400) {
      break;
    }
  }
  smtpSocket.end("QUIT\r\n");

  return replyCodes;
}

test("EM-15.1 the live Chaos section rejects exactly the next message over SMTP", async ({
  page,
  request,
}) => {
  const failedApiCalls = watchFailedApiCalls(page);
  const { smtp_address: smtpAddress } = await (
    await request.get("/api/v1/info")
  ).json();
  await page.goto("/settings?section=chaos");

  await page.getByLabel("Reject the next").fill("1");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }),
  ).toContainText("Chaos on");
  const { chaos_smtp_reject_code: rejectCode } = await (
    await request.get("/api/v1/settings")
  ).json();
  const rejectedReplies = await sendOverSmtp(smtpAddress, "Chaos rejected");
  const acceptedReplies = await sendOverSmtp(smtpAddress, "Chaos accepted");

  expect(rejectedReplies).toContain(rejectCode);
  expect(acceptedReplies.every((replyCode) => replyCode < 400)).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }),
  ).not.toContainText("Chaos on");
  expect(failedApiCalls).toEqual([]);
});
