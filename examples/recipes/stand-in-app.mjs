// Stands in for the reader's app in the recipe examples: each route does what the recipe's
// "In your code" step says the app does, through SendMock's API and the provider port, the way
// a real app's mailer, Twilio client and Slack webhook would.
import { createServer } from "node:http";

const sendmockApiUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl =
  process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const appPorts = [3000, 5000, 8000, 8080];
const twilioAccountSid = "AC00000000000000000000000000000001";
const verifyServiceSid = "VA00000000000000000000000000000001";
const appSender = "Shop <no-reply@shop.test>";
const signUpCode = "482913";

const appState = {
  loginPhoneNumber: null,
};

async function callSendMock(method, path, jsonBody) {
  const response = await fetch(`${sendmockApiUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
  });
  if (!response.ok) {
    throw new Error(
      `${method} ${path} answered ${response.status}: ${await response.text()}`,
    );
  }
}

async function sendAppEmail(recipient, subject, text) {
  await callSendMock("POST", "/api/v1/send", {
    from: appSender,
    to: [recipient],
    subject,
    text,
  });
}

/** Posts a form to Twilio's API on the provider port, as the Twilio SDK does. */
async function callTwilio(path, formFields) {
  const basicAuth = Buffer.from(`${twilioAccountSid}:any-auth-token`).toString(
    "base64",
  );
  const response = await fetch(`${providerUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(formFields).toString(),
  });

  return {
    status: response.status,
    answer: await response.json().catch(() => null),
  };
}

async function sendAppSms(recipientNumber, text) {
  const { status, answer } = await callTwilio(
    `/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    { From: "+15005550006", To: recipientNumber, Body: text },
  );
  if (status >= 400) {
    throw new Error(
      `Twilio Messages answered ${status}: ${JSON.stringify(answer)}`,
    );
  }
}

const appRoutes = {
  "POST /forgot-password": async (requestBody) => {
    await sendAppEmail(
      requestBody.email,
      "Reset your password",
      "Choose a new password here: http://localhost:3000/reset-password?token=f81d4fae",
    );
  },
  "POST /reset-password": async (requestBody) => {
    if (!String(requestBody.link ?? "").includes("/reset-password?token=")) {
      return { statusCode: 422, answer: { error: "not a reset link" } };
    }
  },
  "POST /register": async (requestBody) => {
    await sendAppEmail(
      requestBody.email,
      "Confirm your email",
      `Your sign-up code is ${signUpCode}.`,
    );
  },
  "POST /verify": async (requestBody) => {
    if (requestBody.code !== signUpCode) {
      return { statusCode: 422, answer: { error: "wrong code" } };
    }
  },
  "POST /invitations": async (requestBody) => {
    await sendAppEmail(
      requestBody.email,
      "You are invited",
      "Join the team at Shop.",
    );
  },
  "POST /tickets/318/notify": async () => {
    await sendAppEmail(
      "rahim@example.test",
      "Ticket 318 updated",
      "We replaced the charger. Reply to this email if it still fails.",
    );
  },
  "POST /orders/42/notify": async () => {
    await sendAppSms("+8801700000000", "Order 42 is on its way.");
  },
  "POST /orders/42/fail": async () => {
    const response = await fetch(`${sendmockApiUrl}/catch/slack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: ":warning: Order 42 failed: card declined",
      }),
    });
    if (!response.ok) {
      throw new Error(`The Slack webhook answered ${response.status}`);
    }
  },
  "POST /login": async (requestBody) => {
    appState.loginPhoneNumber = requestBody.phone;
    const { status, answer } = await callTwilio(
      `/v2/Services/${verifyServiceSid}/Verifications`,
      { To: requestBody.phone, Channel: "sms" },
    );
    if (status >= 400) {
      throw new Error(
        `Twilio Verify answered ${status}: ${JSON.stringify(answer)}`,
      );
    }
  },
  // The recipe enters an expired code: the app refuses it as its users would see, with a page
  // that says so, not an error.
  "POST /login/verify": async (requestBody) => {
    const { answer } = await callTwilio(
      `/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        To: appState.loginPhoneNumber ?? "",
        Code: String(requestBody.code ?? ""),
      },
    );
    return {
      statusCode: 200,
      answer: { is_logged_in: answer?.status === "approved" },
    };
  },
  "POST /sms/inbound": async () => ({
    statusCode: 200,
    contentType: "text/xml",
    text: "<Response><Message>You are unsubscribed. Reply START to subscribe again.</Message></Response>",
  }),
  "POST /handler-that-is-down": async () => ({
    statusCode: 500,
    answer: { error: "the order handler is down" },
  }),
};

async function readRequestBody(request) {
  const bodyChunks = [];
  for await (const bodyChunk of request) {
    bodyChunks.push(bodyChunk);
  }
  const bodyText = Buffer.concat(bodyChunks).toString("utf8");
  if (
    !(request.headers["content-type"] ?? "").includes("json") ||
    bodyText === ""
  ) {
    return {};
  }

  return JSON.parse(bodyText);
}

function writeAnswer(response, routeAnswer) {
  const statusCode = routeAnswer?.statusCode ?? 200;
  if (routeAnswer?.text !== undefined) {
    response.writeHead(statusCode, { "content-type": routeAnswer.contentType });
    response.end(routeAnswer.text);
    return;
  }
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(routeAnswer?.answer ?? { ok: true }));
}

async function answerRequest(request, response) {
  const routePath = new URL(request.url, "http://localhost").pathname;
  const appRoute = appRoutes[`${request.method} ${routePath}`];
  if (appRoute === undefined) {
    writeAnswer(response, {
      statusCode: 404,
      answer: { error: `no route ${routePath}` },
    });
    return;
  }
  try {
    writeAnswer(response, await appRoute(await readRequestBody(request)));
  } catch (routeError) {
    console.error(`${request.method} ${routePath}: ${routeError.message}`);
    writeAnswer(response, {
      statusCode: 500,
      answer: { error: routeError.message },
    });
  }
}

for (const appPort of appPorts) {
  // No host: the helpers call `localhost`, which can resolve to IPv6 first.
  createServer(answerRequest).listen(appPort, () => {
    console.log(`The stand-in app listens on http://localhost:${appPort}`);
  });
}
