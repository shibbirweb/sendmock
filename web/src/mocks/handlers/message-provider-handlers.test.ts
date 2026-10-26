import { getResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import type {
  MessageProviderDefinition,
  MessageProviderInput,
  MessageProviderPreview,
} from "@/lib/api/types";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { buildSeedToml } from "@/mocks/fixtures/seed-toml";
import { messageProviderHandlers } from "@/mocks/handlers/message-provider-handlers";

async function callApi(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<Response> {
  const response = await getResponse(
    messageProviderHandlers,
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    }),
  );
  if (response === undefined) {
    throw new Error(`No mock handler for ${method} ${path}`);
  }

  return response;
}

async function readJson<ResponseType>(
  response: Response,
): Promise<ResponseType> {
  return (await response.json()) as ResponseType;
}

/** The definition without the read-only fields, as the Save button sends it. */
const readOnlyFields = new Set([
  "area",
  "is_builtin",
  "is_modified",
  "is_removed",
  "message_count_24h",
]);

function toInput(provider: MessageProviderDefinition): MessageProviderInput {
  return Object.fromEntries(
    Object.entries(provider).filter(
      ([fieldName]) => !readOnlyFields.has(fieldName),
    ),
  ) as MessageProviderInput;
}

beforeEach(() => {
  replaceMockDatabase("standard");
});

describe("email and SMS provider API", () => {
  test("EM-18.1 lists the six email built-ins with secrets masked", async () => {
    const providers = await readJson<MessageProviderDefinition[]>(
      await callApi("GET", "/emails/providers"),
    );

    expect(providers.map((provider) => provider.name)).toEqual([
      "SendGrid",
      "Mailgun",
      "Postmark",
      "Resend",
      "Amazon SES",
      "Brevo",
    ]);
    expect(JSON.stringify(providers)).not.toContain("SG.test_key_123");
  });

  test("SM-16.1 lists the five SMS built-ins and the demo's custom provider", async () => {
    const providers = await readJson<MessageProviderDefinition[]>(
      await callApi("GET", "/sms/providers"),
    );

    expect(providers.map((provider) => provider.key)).toEqual([
      "twilio",
      "twilio_verify",
      "vonage",
      "plivo",
      "messagebird",
      "sslwireless",
    ]);
    expect(
      providers.find((provider) => provider.key === "sslwireless")?.is_builtin,
    ).toBe(false);
  });

  test("EM-18.2 adds a provider copied from a built-in and refuses a key that exists", async () => {
    const createResponse = await callApi("POST", "/emails/providers", {
      name: "Acme Mail",
      key: "acme_mail",
      start_from: "sendgrid",
    });
    const createdProvider =
      await readJson<MessageProviderDefinition>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createdProvider.operations[0]?.path).toBe("/v3/mail/send");
    expect(createdProvider.host).toBe("acme_mail.example.test");
    expect(
      (
        await callApi("POST", "/emails/providers", {
          name: "Again",
          key: "acme_mail",
          start_from: null,
        })
      ).status,
    ).toBe(409);
  });

  test("EM-18.3 an edited built-in shows Modified and Reset to default restores it", async () => {
    const sendgrid = await readJson<MessageProviderDefinition>(
      await callApi("GET", "/emails/providers/sendgrid"),
    );
    const editedProvider = await readJson<MessageProviderDefinition>(
      await callApi("PATCH", "/emails/providers/sendgrid", {
        ...toInput(sendgrid),
        name: "SendGrid (EU)",
      }),
    );
    expect(editedProvider.is_modified).toBe(true);

    const resetProvider = await readJson<MessageProviderDefinition>(
      await callApi("POST", "/emails/providers/sendgrid/reset"),
    );
    expect(resetProvider.name).toBe("SendGrid");
    expect(resetProvider.is_modified).toBe(false);
  });

  test("SM-16.3 a built-in is removed and restored; a custom provider is deleted", async () => {
    expect((await callApi("DELETE", "/sms/providers/vonage")).status).toBe(204);
    const removedVonage = await readJson<MessageProviderDefinition>(
      await callApi("GET", "/sms/providers/vonage"),
    );
    expect(removedVonage.is_removed).toBe(true);
    const restoredVonage = await readJson<MessageProviderDefinition>(
      await callApi("POST", "/sms/providers/vonage/restore"),
    );
    expect(restoredVonage.is_removed).toBe(false);

    expect((await callApi("DELETE", "/sms/providers/sslwireless")).status).toBe(
      204,
    );
    expect((await callApi("GET", "/sms/providers/sslwireless")).status).toBe(
      404,
    );
    expect(
      mockDatabase.smsMessages.some(
        (smsMessage) => smsMessage.api === "sslwireless",
      ),
    ).toBe(true);
  });

  test("SM-16.4 a save with a template error or a clashing path is refused with the reason", async () => {
    const twilio = await readJson<MessageProviderDefinition>(
      await callApi("GET", "/sms/providers/twilio"),
    );
    const brokenResponse = await callApi("PATCH", "/sms/providers/twilio", {
      ...toInput(twilio),
      message_id_template: "SM{{ random_hex(32) ",
    });
    expect(brokenResponse.status).toBe(400);

    const plivo = await readJson<MessageProviderDefinition>(
      await callApi("GET", "/sms/providers/plivo"),
    );
    const clashResponse = await callApi("PATCH", "/sms/providers/plivo", {
      ...toInput(plivo),
      host: null,
      operations: twilio.operations,
    });
    expect(clashResponse.status).toBe(400);
    expect(JSON.stringify(await clashResponse.json())).toContain("Twilio");
  });

  test("EM-18.4 the preview stores the sample send and answers like SendGrid", async () => {
    const sendgrid = await readJson<MessageProviderDefinition>(
      await callApi("GET", "/emails/providers/sendgrid"),
    );
    const providerPreview = await readJson<MessageProviderPreview>(
      await callApi("POST", "/emails/providers/sendgrid/preview", {
        provider: toInput(sendgrid),
      }),
    );

    expect(providerPreview.operation_kind).toBe("send");
    expect(providerPreview.stored_message?.to).toEqual(["ana@example.test"]);
    expect(providerPreview.response.status).toBe(202);
    expect(providerPreview.problems).toEqual([]);
  });

  test("SM-16.4 a send without a recipient gets the provider's own error", async () => {
    const twilio = await readJson<MessageProviderDefinition>(
      await callApi("GET", "/sms/providers/twilio"),
    );
    const providerPreview = await readJson<MessageProviderPreview>(
      await callApi("POST", "/sms/providers/twilio/preview", {
        provider: toInput(twilio),
        sample_request: {
          method: "POST",
          path: "/2010-04-01/Accounts/ACtest/Messages.json",
          headers: {},
          body: "From=%2B15005550006&Body=Hi",
        },
      }),
    );

    expect(providerPreview.stored_message).toBeNull();
    expect(providerPreview.response.status).toBe(400);
    expect(providerPreview.response.body).toContain("21604");
  });

  test("EM-18.6 a secret credential is revealed only on request", async () => {
    expect(
      await readJson(
        await callApi("GET", "/emails/providers/sendgrid/credentials/api_key"),
      ),
    ).toEqual({ name: "api_key", value: "SG.test_key_123" });
  });

  test("SM-16.7 the seed file exports custom and removed providers with secrets as references", async () => {
    await callApi("DELETE", "/sms/providers/messagebird");
    const seedToml = buildSeedToml(mockDatabase);

    expect(seedToml).toContain("[[sms.providers]]");
    expect(seedToml).toContain('key = "sslwireless"');
    expect(seedToml).toContain('key = "messagebird"');
    expect(seedToml).not.toContain('key = "twilio"');
    expect(seedToml).not.toContain("ssl-demo-token");
    expect(seedToml).toContain("SSLWIRELESS_API_TOKEN_SECRET");
  });
});
