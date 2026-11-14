import type { PlaygroundRequest } from "./bridge-messages";

/** Values a step reads from earlier steps' answers. */
export type ScenarioContext = Record<string, string>;

export type ScenarioStep = {
  title: string;
  buildRequest: (scenarioContext: ScenarioContext) => PlaygroundRequest;
  /** What the step learned (merged into the context) and a one-line result. */
  readAnswer: (answerBody: unknown) => {
    learned: ScenarioContext;
    summary: string;
  };
};

export type Scenario = { key: string; title: string; steps: ScenarioStep[] };

const jsonHeaders = { "content-type": "application/json" };
const testPhoneNumber = "+8801712345678";

function postJson(path: string, payload: unknown): PlaygroundRequest {
  return {
    method: "POST",
    path,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

function getJson(path: string): PlaygroundRequest {
  return { method: "GET", path, headers: {}, body: null };
}

function readField(answerBody: unknown, fieldName: string): string {
  return String(
    (answerBody as Record<string, unknown> | null)?.[fieldName] ?? "",
  );
}

/** Multi-step flows, like `sendmock scenario run` (WS-04.3). */
export const scenarios: Scenario[] = [
  {
    key: "sms-otp",
    title: "Sign-up code by SMS",
    steps: [
      {
        title: "Your app sends the code",
        buildRequest: () =>
          postJson("/api/v1/sms", {
            from: "+15550001111",
            to: testPhoneNumber,
            body: "Your Acme code is 731905",
          }),
        readAnswer: (answerBody) => ({
          learned: { smsId: readField(answerBody, "id") },
          summary: `Stored as ${readField(answerBody, "id")}`,
        }),
      },
      {
        title: "Your test finds the newest code message",
        buildRequest: () =>
          getJson(
            `/api/v1/sms?query=${encodeURIComponent("Acme code")}&limit=1`,
          ),
        readAnswer: (answerBody) => {
          const messageBody = readField(
            (answerBody as { items?: unknown[] }).items?.[0],
            "body",
          );
          return {
            learned: { messageBody },
            summary: `Received: ${messageBody}`,
          };
        },
      },
      {
        title: "Your test reads the code and finishes sign-up",
        buildRequest: (scenarioContext) =>
          getJson(`/api/v1/sms/${scenarioContext.smsId}`),
        readAnswer: (answerBody) => {
          const otpCode =
            readField(answerBody, "body").match(/\b\d{4,8}\b/)?.[0] ?? "";
          return { learned: { otpCode }, summary: `Code ${otpCode}` };
        },
      },
    ],
  },
  {
    key: "reset-email",
    title: "Password reset email",
    steps: [
      {
        title: "Your app sends the reset email",
        buildRequest: () =>
          postJson("/api/v1/send", {
            from: "no-reply@acme.test",
            to: ["user@example.test"],
            subject: "Reset your password",
            text: "Use code 482913 or open https://acme.test/reset?token=abc123",
          }),
        readAnswer: (answerBody) => ({
          learned: { emailId: readField(answerBody, "id") },
          summary: `Stored as ${readField(answerBody, "id")}`,
        }),
      },
      {
        title: "Your test opens it and reads the code and link",
        buildRequest: (scenarioContext) =>
          getJson(`/api/v1/emails/${scenarioContext.emailId}`),
        readAnswer: (answerBody) => {
          const extracted = (
            answerBody as { extracted?: { otp?: string[]; links?: string[] } }
          ).extracted;
          const otpCode = extracted?.otp?.[0] ?? "";
          return {
            learned: { otpCode },
            summary: `Code ${otpCode}, link ${extracted?.links?.[0] ?? "none"}`,
          };
        },
      },
    ],
  },
  {
    key: "webhook-test",
    title: "Webhook test delivery",
    steps: [
      {
        title: "Pick the first endpoint",
        buildRequest: () => getJson("/api/v1/webhooks/endpoints"),
        readAnswer: (answerBody) => {
          const firstEndpoint = (answerBody as unknown[])[0];
          return {
            learned: { endpointId: readField(firstEndpoint, "id") },
            summary: `Endpoint ${readField(firstEndpoint, "name")}`,
          };
        },
      },
      {
        title: "Send it a test.ping",
        buildRequest: (scenarioContext) =>
          postJson(
            `/api/v1/webhooks/endpoints/${scenarioContext.endpointId}/test`,
            {},
          ),
        readAnswer: (answerBody) => ({
          learned: { deliveryId: readField(answerBody, "id") },
          summary: `Delivery ${readField(answerBody, "id")}`,
        }),
      },
      {
        title: "Read the delivery result",
        buildRequest: (scenarioContext) =>
          getJson(`/api/v1/webhooks/deliveries/${scenarioContext.deliveryId}`),
        readAnswer: (answerBody) => ({
          learned: {},
          summary: `Status ${readField(answerBody, "status")}, HTTP ${readField(
            (answerBody as { response?: unknown }).response,
            "status_code",
          )}`,
        }),
      },
    ],
  },
];
