// AC: WH-06.2
// SendMock's SendGrid, Resend and Mailgun event webhooks, checked the way an app checks them:
// SendGrid's with its official `@sendgrid/eventwebhook`, Resend's with the Resend SDK's
// `webhooks.verify`, and Mailgun's with the HMAC its docs give (Mailgun ships no helper).
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";

import { EventWebhook } from "@sendgrid/eventwebhook";
import { Resend } from "resend";

/** The public half of SendMock's published SendGrid test key, from the docs. */
const sendgridVerificationKey =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEdZuCtJsfc9vqpbyG5Cknr4QqZWrFTIOUqVuAy9/FtZ3CdY7v0Xd+IwjfbPzxo6nvA60JYfvGMr5ifaJ0Hd5OAA==";
const resendSigningSecret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const mailgunSigningKey = "key-sendmock-example";

const providerChecks = {
  sendgrid: (rawBody, headers) => {
    const eventWebhook = new EventWebhook();
    return eventWebhook.verifySignature(
      eventWebhook.convertPublicKeyToECDSA(sendgridVerificationKey),
      rawBody,
      headers["x-twilio-email-event-webhook-signature"],
      headers["x-twilio-email-event-webhook-timestamp"],
    );
  },
  resend: (rawBody, headers) => {
    try {
      new Resend("re_sendmock_example").webhooks.verify({
        payload: rawBody,
        headers: {
          id: headers["svix-id"],
          timestamp: headers["svix-timestamp"],
          signature: headers["svix-signature"],
        },
        webhookSecret: resendSigningSecret,
      });
      return true;
    } catch {
      return false;
    }
  },
  mailgun: (rawBody) => {
    const { timestamp, token, signature } = JSON.parse(rawBody).signature ?? {};
    const expected = createHmac("sha256", mailgunSigningKey)
      .update(`${timestamp}${token}`)
      .digest("hex");
    return expected === signature;
  },
};

const providerTemplates = {
  sendgrid: "sendgrid.events",
  resend: "resend.events",
  mailgun: "mailgun.events",
};

/** Receives each provider's webhook at /<provider> and keeps whether its signature verified. */
export async function startSignatureReceiver() {
  const verifiedProviders = new Map();
  const receiverServer = createServer((request, response) => {
    const bodyChunks = [];
    request.on("data", (bodyChunk) => bodyChunks.push(bodyChunk));
    request.on("end", () => {
      const providerKey = request.url.slice(1);
      const rawBody = Buffer.concat(bodyChunks).toString("utf8");
      const providerCheck = providerChecks[providerKey];
      verifiedProviders.set(providerKey, Boolean(providerCheck?.(rawBody, request.headers)));
      response.writeHead(200);
      response.end();
    });
  });
  receiverServer.listen(0, "127.0.0.1");
  await once(receiverServer, "listening");
  return {
    receiverServer,
    verifiedProviders,
    receiverOrigin: `http://127.0.0.1:${receiverServer.address().port}`,
  };
}

/** A global secret variable, an endpoint on the provider's template and a rule on deliveries. */
export async function routeProviderWebhooks(callSendMock, receiverOrigin) {
  for (const [variableName, secret] of [
    ["resend_signing_secret", resendSigningSecret],
    ["mailgun_signing_key", mailgunSigningKey],
  ]) {
    await callSendMock("POST", "/webhooks/variables", {
      name: variableName,
      kind: "secret",
      scope: "global",
      value: secret,
      description: "Signs SendMock's event webhooks for the SDK check",
    });
  }
  for (const [providerKey, templateId] of Object.entries(providerTemplates)) {
    const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
      name: `${providerKey} events`,
      url: `${receiverOrigin}/${providerKey}`,
      is_enabled: true,
      method: "POST",
      headers: {},
      extra_fields: {},
      template_id: templateId,
      template_mode: "linked",
      timeout_ms: 10_000,
      retry_policy: { max_attempts: 2, backoff_seconds: [1], retry_on_client_errors: false },
      query_params: [],
      body_mode: "template",
      body_fields: [],
      fields_encoding: "json",
      raw_content_type: "application/json",
      raw_body: "",
      render_mode: "strict",
    });
    await callSendMock("POST", "/webhooks/rules", {
      name: `${providerKey} deliveries`,
      endpoint_id: endpoint.id,
      events: ["email.delivered"],
      is_enabled: true,
      filter: { field: "source", operator: "equals", value: providerKey },
    });
  }
}

export const signedProviders = Object.keys(providerTemplates);
