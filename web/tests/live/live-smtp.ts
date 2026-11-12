import { createConnection, type Socket } from "node:net";

/** Reads SMTP replies line by line; a reply ends on the line without a `-` after its code. */
export function readSmtpReplies(smtpSocket: Socket) {
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

/**
 * Sends many messages over one SMTP session, one after another as fast as the server answers,
 * the way an app's queue worker floods a mail server. Calls `onMessageAccepted` with each
 * message's number (from 1) once the server has accepted it.
 */
export async function sendBurstOverSmtp(
  smtpAddress: string,
  messageCount: number,
  buildSubject: (messageNumber: number) => string,
  onMessageAccepted: (messageNumber: number) => void,
): Promise<void> {
  const [smtpHost, smtpPort] = smtpAddress.split(":");
  const smtpSocket = createConnection({
    host: smtpHost,
    port: Number(smtpPort),
  });
  const readNextReply = readSmtpReplies(smtpSocket);
  const sendCommand = async (smtpCommand: string) => {
    const nextReply = readNextReply();
    smtpSocket.write(`${smtpCommand}\r\n`);
    const replyCode = await nextReply;
    if (replyCode >= 400) {
      throw new Error(
        `SMTP refused "${smtpCommand.split("\r\n")[0]}" with ${replyCode}`,
      );
    }
  };

  await readNextReply();
  await sendCommand("EHLO queue.shop.test");
  for (
    let messageNumber = 1;
    messageNumber <= messageCount;
    messageNumber += 1
  ) {
    const subject = buildSubject(messageNumber);
    await sendCommand("MAIL FROM:<app@shop.test>");
    await sendCommand("RCPT TO:<sam@example.test>");
    await sendCommand("DATA");
    await sendCommand(
      `From: app@shop.test\r\nTo: sam@example.test\r\nSubject: ${subject}\r\n\r\nYour order is on its way.\r\n.`,
    );
    onMessageAccepted(messageNumber);
  }
  smtpSocket.end("QUIT\r\n");
}
