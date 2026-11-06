import { connect, type Socket } from "node:net";

export type TestEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

/** Reads whole SMTP replies (the last line of a reply has a space after its code). */
function createReplyReader(socket: Socket) {
  let receivedText = "";
  let waitingReader: (() => void) | null = null;
  socket.on("data", (chunk) => {
    receivedText += chunk.toString();
    waitingReader?.();
  });
  const takeReply = (): string | null => {
    const lines = receivedText.split("\r\n");
    const lastLineIndex = lines.findIndex((line) => /^\d{3} /.test(line));
    if (lastLineIndex === -1) {
      return null;
    }
    receivedText = lines.slice(lastLineIndex + 1).join("\r\n");
    return lines.slice(0, lastLineIndex + 1).join("\n");
  };
  return async (expectedCode: number): Promise<string> => {
    let reply = takeReply();
    while (reply === null) {
      await new Promise<void>((resolve, reject) => {
        waitingReader = resolve;
        socket.once("error", reject);
        socket.once("close", () =>
          reject(new Error("the SMTP server closed the connection")),
        );
      });
      reply = takeReply();
    }
    if (!reply.split("\n").at(-1)?.startsWith(String(expectedCode))) {
      throw new Error(`expected SMTP ${expectedCode}, got: ${reply}`);
    }
    return reply;
  };
}

/** Sends one plain email the way an app's mailer does, and waits for the server to take it. */
export async function sendTestEmail(smtpAddress: string, email: TestEmail) {
  const [host = "127.0.0.1", port = "1025"] = smtpAddress.split(":");
  const socket = connect(Number(port), host);
  const readReply = createReplyReader(socket);
  const sendCommand = async (command: string, expectedCode: number) => {
    socket.write(`${command}\r\n`);
    return readReply(expectedCode);
  };
  try {
    await readReply(220);
    await sendCommand("EHLO release-test.local", 250);
    await sendCommand(`MAIL FROM:<${email.from}>`, 250);
    await sendCommand(`RCPT TO:<${email.to}>`, 250);
    await sendCommand("DATA", 354);
    const message = [
      `From: ${email.from}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      "",
      email.text,
      ".",
    ].join("\r\n");
    await sendCommand(message, 250);
    await sendCommand("QUIT", 221);
  } finally {
    socket.destroy();
  }
}
