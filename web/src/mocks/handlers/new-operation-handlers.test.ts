import { getResponse, HttpHandler } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import type {
  EmailDetail,
  OtpLookup,
  OutcomeTestResult,
  ScenarioReport,
  TagRule,
} from "@/lib/api/types";
import { registerMockRequestHandlers } from "@/mocks/automation/mock-request-dispatcher";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { mockHandlers } from "@/mocks/handlers";
import { applyMessageRules } from "@/mocks/automation/apply-message-rules";

const httpHandlers = mockHandlers.filter(
  (mockHandler): mockHandler is HttpHandler =>
    mockHandler instanceof HttpHandler,
);

async function callApi(
  method: string,
  path: string,
  requestBody?: unknown,
  contentType = "application/json",
): Promise<Response> {
  const response = await getResponse(
    httpHandlers,
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": contentType },
      body:
        requestBody === undefined
          ? undefined
          : typeof requestBody === "string"
            ? requestBody
            : JSON.stringify(requestBody),
    }),
  );
  if (response === undefined) {
    throw new Error(`No mock handler for ${method} ${path}`);
  }

  return response;
}

beforeEach(() => {
  replaceMockDatabase("standard");
  registerMockRequestHandlers(httpHandlers);
});

describe("operations added for surface parity", () => {
  test("UI-11.5 a raw message and an incoming email are stored, and the latest is found", async () => {
    const rawMessage = [
      "From: App <app@app.test>",
      "To: rahim@example.test",
      "Subject: Raw hello",
      "Content-Type: text/plain",
      "",
      "Your code is 551177.",
    ].join("\r\n");
    expect(
      (await callApi("POST", "/send/raw", rawMessage, "message/rfc822")).status,
    ).toBe(201);
    expect(
      (
        await callApi("POST", "/emails/inbound", {
          from: "rahim@example.test",
          to: ["support@inbound.app.test"],
          subject: "Help please",
          text: "It broke.",
        })
      ).status,
    ).toBe(201);

    const latestEmail = (await (
      await callApi("GET", "/emails/latest?to=rahim@example.test")
    ).json()) as EmailDetail;
    expect(latestEmail.subject).toBe("Raw hello");
    expect(latestEmail.source).toBe("sendmail");
    expect(mockDatabase.emails[0]?.direction).toBe("inbound");
  });

  test("UI-11.5 wait, otp and links find what just arrived", async () => {
    await callApi("POST", "/samples/email", {
      to: "wait@example.test",
      subject: "Code inside",
    });
    const waitedEmail = (await (
      await callApi("GET", "/wait/email?to=wait@example.test&timeout=1s")
    ).json()) as EmailDetail;
    expect(waitedEmail.subject).toBe("Code inside");

    const otpLookup = (await (
      await callApi("GET", "/otp?to=wait@example.test")
    ).json()) as OtpLookup;
    expect(otpLookup.code).toBe("739104");
    expect(
      (await callApi("GET", "/wait/sms?to=%2B10000000000&timeout=200ms"))
        .status,
    ).toBe(408);
  });

  test("UI-11.5 outcome tests answer with the testers' text", async () => {
    const emailResult = (await (
      await callApi("POST", "/outcome-rules/email/test", {
        address: "bounce+hard@shop.test",
      })
    ).json()) as OutcomeTestResult;
    expect(emailResult.summary).toBe("Magic address: Hard bounce (550 5.1.1)");

    const smsResult = (await (
      await callApi("POST", "/outcome-rules/sms/test", {
        number: "+15005550001",
        match_field: "to",
      })
    ).json()) as OutcomeTestResult;
    expect(smsResult).toMatchObject({
      source: "magic",
      summary: "Magic number: Invalid number (21211)",
    });
  });

  test("UI-11.5 single definitions, test values, events, integrations and AI setup answer", async () => {
    for (const path of [
      "/payments/gateways/stripe",
      "/payments/methods/bkash",
      "/payments/flows/wallet",
      `/webhooks/endpoints/${mockDatabase.webhookEndpoints[0]?.id}`,
      `/webhooks/rules/${mockDatabase.webhookRules[0]?.id}`,
      "/payments/test-cards",
      "/events/recent",
      "/integrations/django?channel=sms",
      "/ai/agents",
      "/ai/skill",
    ]) {
      expect((await callApi("GET", path)).status, path).toBe(200);
    }
  });

  test("UI-11.5 a scenario is validated and run step by step", async () => {
    const scenarioText = [
      'name = "sample code"',
      "[[steps]]",
      'run = "sample.send"',
      'with = { kind = "email", to = "scenario@example.test" }',
      "[[steps]]",
      'run = "otp.get"',
      'with = { to = "scenario@example.test" }',
      'save = "otp"',
      "[[steps]]",
      'run = "assert"',
      'with = { that = "{{ otp.code | length }} == 6" }',
      "[[steps]]",
      'run = "http"',
      'with = { method = "POST", url = "http://localhost:8000/login" }',
    ].join("\n");
    const validation = await (
      await callApi("POST", "/scenarios/validate", {
        scenario: 'run = 1\n[[steps]]\nrun = "nope"',
      })
    ).json();
    expect(validation).toMatchObject({ is_valid: false });

    const scenarioReport = (await (
      await callApi("POST", "/scenarios/run", { scenario: scenarioText })
    ).json()) as ScenarioReport;
    expect(scenarioReport.steps.map((stepResult) => stepResult.status)).toEqual(
      ["passed", "passed", "passed", "skipped"],
    );
    expect(scenarioReport.is_passed).toBe(true);
  });

  test("EM-12.3 a tag rule tags matching new mail; EM-14.3 a forward rule releases it", async () => {
    const createdRule = (await (
      await callApi("POST", "/tag-rules", {
        name: "Receipts",
        filter: { field: "subject", operator: "contains", value: "Receipt" },
        tag: "receipts",
        is_enabled: true,
      })
    ).json()) as TagRule;
    expect(createdRule.position).toBe(2);
    mockDatabase.settings.relay_smtp_url = "smtp://relay.test:587";
    mockDatabase.settings.relay_recipient_allowlist = ["*@company.com"];
    await callApi(
      "PATCH",
      `/forward-rules/${mockDatabase.messageRules.forwardRules[0]?.id}`,
      {
        is_enabled: true,
        filter: { field: "subject", operator: "contains", value: "Receipt" },
      },
    );

    await callApi("POST", "/samples/email", { subject: "Receipt 42" });
    const arrivedEmail = mockDatabase.emails[0];
    if (arrivedEmail === undefined) {
      throw new Error("No email stored");
    }
    applyMessageRules(arrivedEmail);
    expect(arrivedEmail.tags).toContain("receipts");
    expect(
      mockDatabase.emailTimelines
        .get(arrivedEmail.id)
        ?.map((entry) => entry.detail),
    ).toContain(
      "Forwarded by rule QA inbox to the team to qa-team@company.com (demo: nothing was sent)",
    );

    const movedRules = (await (
      await callApi("POST", `/tag-rules/${createdRule.id}/move`, {
        direction: "up",
      })
    ).json()) as TagRule[];
    expect(movedRules[0]?.name).toBe("Receipts");
    expect(
      (await callApi("DELETE", `/tag-rules/${createdRule.id}`)).status,
    ).toBe(204);
  });
});
