import { createConnection, type Socket } from "node:net";

import { expect, test } from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

/** Reads SMTP replies line by line; a reply ends on the line without a `-` after its code. */
function readSmtpReplies(smtpSocket: Socket) {
  let receivedText = "";
  const waitingReaders: ((replyCode: number) => void)[] = [];
  smtpSocket.on("data", (dataChunk) => {
    receivedText += dataChunk.toString("utf8");
    let lineEnd = receivedText.indexOf("\r\n");
    while (lineEnd !== -1) {
      const replyLine = receivedText.slice(0, lineEnd);
      receivedText = receivedText.slice(lineEnd + 2);
      if (replyLine[3] !== "-") {
        waitingReaders.shift()?.(Number(replyLine.slice(0, 3)));
      }
      lineEnd = receivedText.indexOf("\r\n");
    }
  });

  return () =>
    new Promise<number>((resolve) => {
      waitingReaders.push(resolve);
    });
}

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
