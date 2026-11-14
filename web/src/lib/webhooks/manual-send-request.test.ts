import { describe, expect, test } from "vitest";

import type {
  RenderProblem,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookTemplateSummary,
} from "@/lib/api/types";
import { defaultEndpointRequest } from "@/lib/webhooks/endpoint-request-defaults";
import {
  buildSendEndpointInput,
  findBlockingProblems,
  pickEndpointInput,
  suggestSendEndpoint,
  toSendVariables,
} from "@/lib/webhooks/manual-send-request";

const endpointInput: WebhookEndpointInput = {
  name: "Laravel inbound mail",
  url: "http://localhost:8000/hooks",
  method: "POST",
  headers: { "X-Team": "ops" },
  extra_fields: { environment: "local" },
  template_id: "native",
  template_mode: "linked",
  timeout_ms: 10_000,
  retry_policy: {
    max_attempts: 1,
    backoff_seconds: [],
    retry_on_client_errors: false,
  },
  is_enabled: true,
  ...defaultEndpointRequest,
  body_mode: "raw",
  raw_body: "{}",
};

function buildProblem(changedFields: Partial<RenderProblem>): RenderProblem {
  return {
    message: "Unknown function: nope",
    severity: "error",
    source: "body",
    line: 1,
    column: 1,
    ...changedFields,
  };
}

describe("buildSendEndpointInput", () => {
  test("WH-05.1 a chosen format makes the template the body for this send", () => {
    expect(
      buildSendEndpointInput(endpointInput, {
        template_id: "slack.incoming_webhook",
      }),
    ).toMatchObject({
      body_mode: "template",
      template_id: "slack.incoming_webhook",
      extra_fields: {},
      headers: { "X-Team": "ops" },
      url: "http://localhost:8000/hooks",
    });
    expect(buildSendEndpointInput(endpointInput, {})).toBe(endpointInput);
  });

  test("WH-05.3 a composed request replaces the endpoint's", () => {
    const composedRequest = {
      ...endpointInput,
      url: "http://localhost:9000/other",
    };

    expect(
      buildSendEndpointInput(endpointInput, { request: composedRequest }),
    ).toBe(composedRequest);
  });
});

describe("toSendVariables", () => {
  test("WH-05.5 overrides win over Prompt answers; vars. and blank names are handled", () => {
    expect(
      toSendVariables(
        { reason: "smoke run", tenant_id: "acme" },
        { "vars.tenant_id": "globex", " ": "ignored" },
      ),
    ).toEqual({ reason: "smoke run", tenant_id: "globex" });
  });
});

describe("findBlockingProblems", () => {
  test("WH-05.6 errors block a send; an edited body no longer counts body errors", () => {
    const problems = [
      buildProblem({}),
      buildProblem({ source: "header.0", line: null, column: null }),
      buildProblem({ severity: "warning", message: "Undefined variable: x" }),
    ];

    expect(findBlockingProblems(problems, false)).toHaveLength(2);
    expect(findBlockingProblems(problems, true)).toEqual([problems[1]]);
  });
});

describe("pickEndpointInput", () => {
  test("keeps only the request fields of a saved endpoint", () => {
    const savedEndpoint = { ...endpointInput, id: "01J", secret: "whsec_x" };

    expect(pickEndpointInput(savedEndpoint)).toEqual(endpointInput);
  });
});

describe("suggestSendEndpoint", () => {
  test("WH-05.1 starts with an endpoint whose template fits the message kind", () => {
    const mailEndpoint = {
      ...endpointInput,
      id: "mail",
      template_id: "postmark",
    };
    const smsEndpoint = { ...endpointInput, id: "sms", template_id: "twilio" };
    const webhookEndpoints = [mailEndpoint, smsEndpoint] as unknown as [
      WebhookEndpoint,
      ...WebhookEndpoint[],
    ];
    const webhookTemplates = [
      { id: "postmark", events: ["email.received"] },
      { id: "twilio", events: ["sms.inbound", "sms.status"] },
    ] as WebhookTemplateSummary[];

    expect(
      suggestSendEndpoint(webhookEndpoints, webhookTemplates, { sms_id: "01" })
        .id,
    ).toBe("sms");
    expect(
      suggestSendEndpoint(webhookEndpoints, webhookTemplates, {
        email_id: "01",
      }).id,
    ).toBe("mail");
    expect(suggestSendEndpoint(webhookEndpoints, [], { sms_id: "01" }).id).toBe(
      "mail",
    );
  });
});
