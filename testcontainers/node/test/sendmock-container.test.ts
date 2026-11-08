import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection } from "node:net";
import { test } from "node:test";

import {
  defaultSendMockImage,
  SendMockContainer,
} from "../src/sendmock-container.ts";

async function readSmtpGreeting(smtpHost: string, smtpPort: number) {
  const smtpSocket = createConnection({ host: smtpHost, port: smtpPort });
  const [greetingChunk] = (await once(smtpSocket, "data")) as [Buffer];
  smtpSocket.end();

  return greetingChunk.toString("ascii");
}

test("DS-06.1 starts the image and gives the SMTP, HTTP and provider addresses", async () => {
  const sendmock = await new SendMockContainer(
    process.env.SENDMOCK_IMAGE ?? defaultSendMockImage,
  ).start();

  try {
    const healthResponse = await fetch(
      `${sendmock.getHttpUrl()}/api/v1/health`,
    );
    const twilioResponse = await fetch(
      `${sendmock.getProviderUrl()}/2010-04-01/Accounts/AC00000000000000000000000000000004/Messages.json`,
      {
        method: "POST",
        body: new URLSearchParams({
          From: "+15005550006",
          To: "+14155550103",
          Body: "From Node",
        }),
      },
    );
    const smtpGreeting = await readSmtpGreeting(
      sendmock.getSmtpHost(),
      sendmock.getSmtpPort(),
    );

    assert.equal(healthResponse.status, 200);
    assert.equal(twilioResponse.status, 201, await twilioResponse.text());
    assert.match(smtpGreeting, /^220 /);
  } finally {
    await sendmock.stop();
  }
});
